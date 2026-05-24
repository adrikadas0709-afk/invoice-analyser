const { GoogleGenAI } = require("@google/genai");

const getGeminiApiKey = () => {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  return key.trim().replace(/^['"]|['"]$/g, "");
};

const generateWithRetry = async (ai, prompt, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
    } catch (error) {
      const is429 = error.message?.includes("429") || error.status === 429;
      if (is429 && attempt < maxRetries) {
        const retryMatch = error.message?.match(/retry in (\d+)/i);
        const delayMs = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : attempt * 5000;
        console.log(`[Retry ${attempt}/${maxRetries}] Rate limited. Waiting ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
};

const askChatbot = async (req, res) => {
  try {
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Missing Gemini API key. Add GEMINI_API_KEY or GOOGLE_API_KEY to backend/.env.",
      });
    }

    const { question, invoiceSummary: providedSummary } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: "Question is required",
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const invoiceSummary = providedSummary || "No invoices available.";

    const prompt = `
      You are an AI financial assistant.
      Analyze the invoice summary.

      Invoice Summary:
      ${invoiceSummary}

      User Question:
      ${question}

      Give short smart answers.
    `;

    const result = await generateWithRetry(ai, prompt);

    res.status(200).json({
      success: true,
      question,
      reply: result.text,
    });
  } catch (error) {
    console.log("CHATBOT ERROR =>", error.message);

    const is429 = error.message?.includes("429") || error.message?.includes("quota");
    res.status(is429 ? 429 : 500).json({
      success: false,
      error: is429
        ? "AI quota limit reached. Please wait a minute and try again, or upgrade your Gemini API plan."
        : error.message,
    });
  }
};

module.exports = {
  askChatbot,
};
