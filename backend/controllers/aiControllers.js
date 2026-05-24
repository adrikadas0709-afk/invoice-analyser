const fs = require("fs");
const { extractInvoiceData } = require("../services/aiservice");

const extractInvoiceWithFinancialAnalysis = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No invoice file uploaded.",
      });
    }

    const result = await extractInvoiceData(req.file.path);

    res.json({
      success: true,
      data: result.data,
      rawText: result.rawText,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "AI financial analysis failed",
      error: error.message,
    });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => {});
    }
  }
};

module.exports = {
  extractInvoiceWithFinancialAnalysis,
};
