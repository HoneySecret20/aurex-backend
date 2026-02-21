const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const axios = require("axios");
const User = require("../models/User");

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, referredBy } = req.body;

    // Check duplicate email
    const existingEmail = await User.findOne({ email });
    if (existingEmail)
      return res.status(400).json({ message: "Email already registered" });

    // Check duplicate username
    const existingUsername = await User.findOne({ username });
    if (existingUsername)
      return res.status(400).json({ message: "Username already taken" });

    // Generate referral code
    const referralCode = Math.random().toString(36).substring(2, 8);

    // Create new user with welcome bonus
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
        password: hashedPassword,
      referralCode,
      referredBy,
      balance: 200, // 🔥 WELCOME BONUS
      referralsCount: 0,
      paid: false
    });

    await newUser.save();

    res.status(201).json({ message: "Registration successful" });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: err.message });
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

// COMPLETE TASK
router.post("/complete-task", async (req, res) => {
  const { email, reward } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    // Get today's date string
    const today = new Date().toISOString().split("T")[0];

    // Check if task already done today
    if (user.tasksCompleted.includes(today)) {
      return res.status(400).json({
        message: "Task already completed today"
      });
    }

    // Add reward
    user.balance += reward;

    // Save today's task
    user.tasksCompleted.push(today);

    await user.save();

    res.json({
      message: "Task completed",
      balance: user.balance
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
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

const crypto = require("crypto");

router.post("/paystack-webhook", async (req, res) => {

  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(req.rawBody)
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    return res.status(400).send("Invalid signature");
  }

  const event = req.body;

  // We only care about successful payments
  if (event.event === "charge.success") {

    const email = event.data.customer.email;

    try {
      const user = await User.findOne({ email });

      if (!user) return res.sendStatus(200);

      if (!user.paid) {

        user.paid = true;

        // 🎯 Referral bonus
        if (user.referredBy) {
          const referrer = await User.findOne({
            referralCode: user.referredBy
          });

          if (referrer) {
            referrer.balance += 750;
            referrer.referralsCount += 1;
            await referrer.save();
          }
        }

        await user.save();
      }

    } catch (err) {
      console.error(err);
    }
  }

  res.sendStatus(200);
});

module.exports = router;

