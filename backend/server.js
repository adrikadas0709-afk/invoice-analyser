require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require ("express-rate-limit");
const fs = require("fs");
const path = require("path");
const connectDB = require("./config/db");

/*Import Routes & Middleware*/

const invoiceRoutes = require('./routes/invoiceRoutes');
const summaryRoutes = require('./routes/summaryRoutes');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require("./routes/chatroutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

/*Middleware to handle CORS   */ 
app.use(
    cors({
        origin:"*",
        methods: ["GET","POST","PUT","DELETE"],
        allowedHeaders: ["Content-Type","Authorization"],
    })
);

/* Connect Database */
connectDB();

/*Body Parser Middleware */
app.use(express.json());

/*Security Middleware */
app.use(helmet());

/*Logging Middleware */
app.use(morgan("dev"));

app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 500,
        skip: (req) => req.path === "/api/invoices/upload",
        standardHeaders: true,
        legacyHeaders: false,
    })
);

app.get("/api/health", (req, res) => {
    res.json({ success: true, message: "API is running" });
});

app.get("/", (req, res) => {
    res.send("WORKING");
});

app.use("/uploads", express.static(uploadsDir));
app.use("/api/auth", authRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ai", aiRoutes);

const frontendDistPath = path.join(__dirname, '../Frontend/dist');
app.use(express.static(frontendDistPath));

app.use("/api", (req, res) => {
    res.status(404).json({ success: false, message: "API Route not found" });
});

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
});
/*Start Server */
const PORT = process.env.PORT || 5000;
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
module.exports = app;
