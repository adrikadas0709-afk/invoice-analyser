const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "../db.json");

// Helper to initialize local db
const initDb = () => {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify({ users: [], invoices: [] }, null, 2),
      "utf8"
    );
  }
};

// Initialize on require
initDb();

const readDb = () => {
  try {
    initDb();
    const data = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading JSON database:", error);
    return { users: [], invoices: [] };
  }
};

const writeDb = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing to JSON database:", error);
  }
};

const getLocalUsers = () => {
  return readDb().users || [];
};

const saveLocalUsers = (users) => {
  const db = readDb();
  db.users = users;
  writeDb(db);
};

const getLocalInvoices = () => {
  return readDb().invoices || [];
};

const saveLocalInvoices = (invoices) => {
  const db = readDb();
  db.invoices = invoices;
  writeDb(db);
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const comparePassword = async (enteredPassword, hashedPassword) => {
  return await bcrypt.compare(enteredPassword, hashedPassword);
};

module.exports = {
  getLocalUsers,
  saveLocalUsers,
  getLocalInvoices,
  saveLocalInvoices,
  hashPassword,
  comparePassword,
};
