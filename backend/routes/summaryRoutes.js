const express = require("express");
const Invoice = require("../models/invoice");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const summary = await Invoice.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ message: "Unable to build summary", error: error.message });
  }
});

module.exports = router;
