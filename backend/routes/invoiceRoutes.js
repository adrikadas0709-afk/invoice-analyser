const express = require("express");
const router = express.Router();
const upload = require("../middlewares/uploadMiddleware");
const { protect, optionalProtect } = require("../middlewares/authMiddleware");
const {
  uploadInvoice,
  getInvoices,
  getInvoiceById,
  deleteInvoice,
  extractInvoiceDataOnly
} = require("../controllers/invoiceController");

// POST: Upload & Parse an Invoice
router.post(
  "/upload",
  protect,
  (req, res, next) => {
    // Intercept Multer validation errors (e.g., file too large, wrong format)
    upload.single("invoice")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  uploadInvoice
);

// POST: Parse an invoice without saving it to the authenticated invoice history
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
  extractInvoiceDataOnly
);

// GET: Fetch logged-in user's invoices, or all invoices when testing without a token
router.get("/", optionalProtect, getInvoices);

// GET: Fetch a single invoice detail view
router.get("/:id", protect, getInvoiceById);

// DELETE: Erase a document record from the system
router.delete("/:id", protect, deleteInvoice);

module.exports = router;
