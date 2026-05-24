const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
    name:{type:String, required:true},
    quantity:{type:Number, default:1},
    unitPrice:{type:Number, default:0},
    price:{type:Number, default:0},
    taxPercent: {type:Number,default:0},
    total:{type:Number, default:0},
});

const invoiceSchema = new mongoose.Schema(
{
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required:true,
  },

  merchant: {
    type: String
  },

  amount: {

    type: Number
  },

  currency: {
    type: String,
    default: "INR"
  },

  currencySymbol: {
    type: String,
    default: "₹"
  },

  tax: {
    type : Number
},
  date: {
    type :String
  },

  category: {
  type :String,
  },

  items: [itemSchema],

  aiInsight: {
    type:String
  },

  fileUrl: {
    type:String
  }

}, {
  timestamps: true
});

module.exports = mongoose.model("Invoice", invoiceSchema);
