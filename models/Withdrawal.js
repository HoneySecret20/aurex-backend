const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema({
  email: String,
  amount: Number,
  status: {
    type: String,
    default: "pending"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
