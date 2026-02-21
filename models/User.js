const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { 
    type: String, 
    unique: true, 
    required: true,
    match: /.+\@.+\..+/ // simple email format validation
  },
  password: { type: String, required: true, minlength: 6 },
  referralCode: { type: String, unique: true, required: true },
  referredBy: { type: String, default: null },
  paid: { type: Boolean, default: false },
  balance: { type: Number, default: 0 },
  tasksCompleted: { type: [String], default: [] },
  referralsCount: { type: Number, default: 0 } // optional: track referrals
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
