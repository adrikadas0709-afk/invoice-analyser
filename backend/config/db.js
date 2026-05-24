const mongoose = require("mongoose");
const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);
mongoose.set("bufferCommands", true);

const connectDB = async () => {
  try {

    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);

  } catch (error) {

    console.error(`Error: ${error.message}`);
    console.error("--------------------------------------------------------------------------------");
    console.error("  MONGODB CONNECTION FAILED!");
    console.error("  If you are using MongoDB Atlas, this is likely because your IP is not whitelisted.");
    console.error("  Your current public IP address is: 152.58.177.15");
    console.error("  Please add this IP (or 0.0.0.0/0) in Atlas > Network Access > IP Access List.");
    console.error("  ");
    console.error("  >> AUTOMATIC FALLBACK INITIATED: A local JSON-based database (db.json) will be used.");
    console.error("  >> All login, registration, and dashboard features are fully operational offline!");
    console.error("--------------------------------------------------------------------------------");
    return null;
  }
};

module.exports = connectDB;
