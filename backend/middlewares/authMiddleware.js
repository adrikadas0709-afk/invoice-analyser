const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/user");
const jsonDb = require("../utils/jsonDb");

const getTokenFromRequest = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    return req.headers.authorization.split(" ")[1];
  }

  return req.headers["x-auth-token"] || null;
};

const protect = async (req, res, next) => {

  const token = getTokenFromRequest(req);

  if (token) {
    try {

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
        req.user = await User.findById(decoded.id);
      } else {
        const users = jsonDb.getLocalUsers();
        req.user = users.find((u) => u._id === decoded.id) || null;
      }

      next();

    } catch (error) {
      res.status(401).json({
        message: "Not authorized"
      });
    }

  } else {
    res.status(401).json({
      message: "No token"
    });
  }
};

const optionalProtect = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      req.user = await User.findById(decoded.id);
    } else {
      const users = jsonDb.getLocalUsers();
      req.user = users.find((u) => u._id === decoded.id) || null;
    }
  } catch (error) {
    return res.status(401).json({
      message: "Not authorized",
    });
  }

  next();
};

module.exports = { protect, optionalProtect };
