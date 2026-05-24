const express = require("express");
const upload = require("../middlewares/uploadMiddleware");
const { extractInvoiceWithFinancialAnalysis } = require("../controllers/aiControllers");

const router = express.Router();

router.post(
  "/extract",
  (req, res, next) => {
    upload.single("invoice")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  extractInvoiceWithFinancialAnalysis
);

module.exports = router;
