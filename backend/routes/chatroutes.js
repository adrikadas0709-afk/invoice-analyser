const express = require("express");

const router = express.Router();

const {
   askChatbot
} = require("../controllers/chatController");

router.post("/", askChatbot);

module.exports = router;