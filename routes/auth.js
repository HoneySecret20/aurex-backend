const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const axios = require("axios");
const User = require("../models/User");

// REGISTER
router.post("/register", async (req, res) => {
  const { username, email, password, referral } = req.body;

  try {
   const existingEmail = await User.findOne({ email });
if (existingEmail)
  return res.status(400).json({ message: "Email already registered" });

const existingUsername = await User.findOne({ username });
if (existingUsername)
  return res.status(400).json({ message: "Username already taken" });


    const hashedPassword = await bcrypt.hash(password, 10);
    const referralCode = Math.random().toString(36).substring(2, 8);

    const user = new User({
      username,
      email,
      password: hashedPassword,
      referralCode,
      referredBy: referral || null
    });

    await user.save();
    res.json({ message: "Registration successful" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

   res.json({
  message: "Login successful",
  user: {
    username: user.username,
    email: user.email,
    balance: user.balance,
    paid: user.paid,
    referralCode: user.referralCode,
    referralsCount: user.referralsCount
  }
});


  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// VERIFY PAYMENT
router.post("/verify-payment", async (req, res) => {
  const { reference, email } = req.body;

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
      }
    );

    const data = response.data.data;

    if (data.status === "success" && data.customer.email === email) {

      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });

      if (!user.paid) {
        user.paid = true;
        user.balance += 200; // Welcome bonus

        // 🎯 REFERRAL BONUS SECTION
        if (user.referredBy) {
          const referrer = await User.findOne({ referralCode: user.referredBy });

          if (referrer) {
            referrer.balance += 750; // Referral bonus
            referrer.referralsCount += 1;
            await referrer.save();
          }
        }

        await user.save();
      }

      res.json({ message: "Payment verified" });

    } else {
      res.status(400).json({ message: "Payment not successful" });
    }

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ message: "Verification failed" });
  }
});

// REQUEST WITHDRAWAL
router.post("/withdraw", async (req, res) => {
  const { email, amount } = req.body;

  try {
    const now = new Date();

    const day = now.getDay(); // 0=Sun, 3=Wed, 5=Fri
    const hour = now.getHours(); // 0–23

    const isCorrectDay = (day === 3 || day === 5);
    const isCorrectTime = (hour >= 18 && hour < 21); // 6PM–9PM

    if (!isCorrectDay || !isCorrectTime) {
      return res.status(400).json({
        message: "Withdrawals allowed only Wed & Fri (6PM – 9PM)"
      });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    user.balance -= amount;
    await user.save();

    const withdrawal = new Withdrawal({
      email,
      amount
    });

    await withdrawal.save();

    res.json({ message: "Withdrawal request submitted" });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;
