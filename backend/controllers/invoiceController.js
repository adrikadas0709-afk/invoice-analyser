const fs = require("fs");
const mongoose = require("mongoose");
const Invoice = require("../models/invoice");
const { GoogleGenAI } = require("@google/genai");
const jsonDb = require("../utils/jsonDb");

const getGeminiApiKey = () => {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  return key.trim().replace(/^['"]|['"]$/g, "");
};

const parseMoney = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return normalized ? Number(normalized[0]) : 0;
};

const extractJsonObject = (text) => {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not contain valid JSON.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
};

const normalizeCurrency = (parsedData) => {
  const rawCurrency = String(parsedData.currency || "").trim().toUpperCase();
  const rawSymbol = String(parsedData.currencySymbol || "").trim();

  if (rawCurrency === "USD" || rawSymbol === "$") {
    return { currency: "USD", currencySymbol: "$" };
  }

  if (rawCurrency === "EUR" || rawSymbol === "€") {
    return { currency: "EUR", currencySymbol: "€" };
  }

  if (rawCurrency === "GBP" || rawSymbol === "£") {
    return { currency: "GBP", currencySymbol: "£" };
  }

  if (rawCurrency === "INR" || rawSymbol === "₹" || rawSymbol === "Rs") {
    return { currency: "INR", currencySymbol: "₹" };
  }

  return {
    currency: rawCurrency || "INR",
    currencySymbol: rawSymbol || "₹",
  };
};

const normalizeItems = (items = []) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    const quantity = parseMoney(item.quantity) || 1;
    const unitPrice =
      parseMoney(item.unitPrice) ||
      parseMoney(item.rate) ||
      parseMoney(item.price) ||
      parseMoney(item.total);
    const total = parseMoney(item.total) || Number((quantity * unitPrice).toFixed(2));

    return {
      name: item.name || item.description || "Invoice item",
      quantity,
      unitPrice,
      price: unitPrice,
      taxPercent: parseMoney(item.taxPercent),
      total,
    };
  });
};

const uploadInvoice = async (req, res) => {
  try {
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return res.status(500).json({
        message: "Missing Gemini API key. Add GEMINI_API_KEY or GOOGLE_API_KEY to backend/.env.",
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // 1. Safety Guard: Verify file upload actually exists
    if (!req.file) {
      return res.status(400).json({ message: "No invoice or receipt file uploaded." });
    }

    // 2. Read the file path into a binary buffer for multi-modal analysis
    const fileBuffer = fs.readFileSync(req.file.path);
    
    const filePart = {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    // 3. Craft a highly generalized prompt instructing the model how to structure its brain mapping
    const structuredAiPrompt = `
      Analyze this invoice/receipt document. Carefully extract all the relevant structural details.
      
      CRITICAL CATEGORIZATION RULES:
      Map the transaction into exactly one of these general business buckets based on its contents:
      - "Food & Beverage": Cafes, diners, groceries, food delivery apps, restaurants.
      - "Travel": Rideshares (Uber/Lyft), fuel, train/flight tickets, parking, tolls.
      - "Shopping": E-commerce, apparel retail stores, electronics.
      - "Bills": Electric, water, rent, mobile recharges, internet services, insurance premiums.
      - "Entertainment": Subscriptions (Netflix/Spotify), movies, gaming platforms, event tickets.
      - "Office Supplies": Paper, stationary, courier shipping, workspace software (SaaS).
      - "Other": Only use if it absolutely matches no general category descriptions above.

      CURRENCY RULES:
      Detect the invoice currency from symbols/codes such as "$", "USD", "₹", "INR", "€", "EUR", "£", or "GBP".
      Do not convert currencies. Return the numeric values exactly in the invoice currency.

      LINE ITEM PRICE RULES:
      For every purchased item, extract quantity, unitPrice, and total.
      If the receipt shows quantity and unit price, total must be quantity multiplied by unitPrice.
      Example: 3 x $4.50 must become quantity: 3, unitPrice: 4.50, total: 13.50.
      Do not take only the first visible price if quantity is greater than 1.
      The invoice amount should be the final grand total/subtotal payable from the receipt, not just the first item price.

      BUDGETING/RECOMMENDATION RULE:
      Evaluate the extracted total amount against typical spending targets. 
      Generate a dynamic 1-2 sentence recommendation advising the user on whether this spending is balanced or excessive for its respective category.

      Return the output STRICTLY as a valid JSON object matching the keys below. 
      Do NOT wrap the response in markdown blocks like \`\`\`json. Return pure raw JSON string text only:
      {
        "merchant": "Name of the business or merchant",
        "date": "Extracted transaction date string",
        "amount": 1240.50,
        "currency": "USD, INR, EUR, GBP, or detected currency code",
        "currencySymbol": "$, ₹, €, £, or detected symbol",
        "tax": 120.25,
        "category": "The specific matching category string chosen from the rule list above",
        "items": [
          { "name": "Item Name/Description", "quantity": 2, "unitPrice": 160, "price": 160, "total": 320 }
        ],
        "aiInsight": "Your personalized 1-2 sentence budget insight text string goes here"
      }
    `;

    // 4. Dispatch multi-modal data array to Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [filePart, structuredAiPrompt],
    });

    // 5. Clean and parse the raw AI string directly into a JavaScript Object
    const rawText = response.text.trim();
    const parsedData = extractJsonObject(rawText);
    const items = normalizeItems(parsedData.items);
    const subtotalFromItems = items.reduce((sum, item) => sum + item.total, 0);
    const tax = parseMoney(parsedData.tax);
    const amount = parseMoney(parsedData.amount) || Number((subtotalFromItems + tax).toFixed(2));
    const { currency, currencySymbol } = normalizeCurrency(parsedData);

    // 6. Persist the record in MongoDB Atlas or fallback to local JSON database
    let invoice;
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      invoice = await Invoice.create({
        user: req.user._id, // Set securely from your JWT auth check middleware!
        merchant: parsedData.merchant || "Unknown Merchant",
        amount,
        currency,
        currencySymbol,
        tax,
        date: parsedData.date || "Unknown Date",
        category: parsedData.category || "Other",
        items,
        aiInsight: parsedData.aiInsight,
        fileUrl: req.file.path // Path to file stored locally in your /uploads folder
      });
    } else {
      const invoices = jsonDb.getLocalInvoices();
      invoice = {
        _id: `offline_invoice_${Date.now()}`,
        user: req.user._id,
        merchant: parsedData.merchant || "Unknown Merchant",
        amount,
        currency,
        currencySymbol,
        tax,
        date: parsedData.date || "Unknown Date",
        category: parsedData.category || "Other",
        items,
        aiInsight: parsedData.aiInsight,
        fileUrl: req.file.path,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      invoices.unshift(invoice);
      jsonDb.saveLocalInvoices(invoices);
    }

    // 7. Return the document straight back to your React/Flutter UI dashboard
    res.status(201).json({
      success: true,
      message: "Invoice successfully analyzed by AI",
      invoice
    });

  } catch (error) {
    console.error("Generalized Processor Error Log:", error);
    res.status(500).json({
      message: "Invoice processing failed",
      error: error.message
    });
  }
};

const getInvoices = async (req, res) => {
  try {
    const filter = req.user?._id ? { user: req.user._id } : {};
    let invoices;

    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      invoices = await Invoice.find(filter).sort({ createdAt: -1 });
    } else {
      invoices = jsonDb.getLocalInvoices();
      if (req.user?._id) {
        invoices = invoices.filter(inv => inv.user === req.user._id);
      }
      invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({
      success: true,
      authRequired: false,
      scope: req.user?._id ? "current-user" : "all-invoices",
      invoices,
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch invoices", error: error.message });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    let invoice;
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    } else {
      const invoices = jsonDb.getLocalInvoices();
      invoice = invoices.find(inv => inv._id === req.params.id && inv.user === req.user._id);
    }

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch invoice", error: error.message });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    let invoice;
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (invoice.fileUrl && fs.existsSync(invoice.fileUrl)) {
        fs.unlinkSync(invoice.fileUrl);
      }

      await invoice.deleteOne();
    } else {
      const invoices = jsonDb.getLocalInvoices();
      const index = invoices.findIndex(inv => inv._id === req.params.id && inv.user === req.user._id);
      if (index === -1) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      invoice = invoices[index];
      if (invoice.fileUrl && fs.existsSync(invoice.fileUrl)) {
        fs.unlinkSync(invoice.fileUrl);
      }

      invoices.splice(index, 1);
      jsonDb.saveLocalInvoices(invoices);
    }

    res.json({ success: true, message: "Invoice deleted" });
  } catch (error) {
    res.status(500).json({ message: "Unable to delete invoice", error: error.message });
  }
};

const extractInvoiceDataOnly = async (req, res) => {
  try {
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Missing Gemini API key. Add GEMINI_API_KEY or GOOGLE_API_KEY to backend/.env.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No invoice file uploaded." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const fileBuffer = fs.readFileSync(req.file.path);
    const filePart = {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const prompt = `
      Extract invoice details from this document.
      Return only a valid JSON object with:
      {
        "invoice_number": "string or null",
        "invoice_date": "string or null",
        "customer_name": "string or null",
        "seller_name": "string or null",
        "total_amount": 0,
        "category": "Food, Travel, Shopping, Bills, Entertainment, Office Supplies, or Other",
        "finance_analysis": {
          "decision": "BUY, CAUTION, or AVOID",
          "reason": "short reason"
        }
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [filePart, prompt],
    });
    const data = extractJsonObject(response.text);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  uploadInvoice,
  getInvoices,
  getInvoiceById,
  deleteInvoice,
  extractInvoiceDataOnly,
};
