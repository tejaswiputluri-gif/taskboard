import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = Router();
const sign = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email });
const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

router.post("/register", async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!name || !email || password.length < 6)
      return res.status(400).json({ message: "Enter a name, an email, and a password of 6+ characters." });
    if (await User.findOne({ email }))
      return res.status(409).json({ message: "That email already has an account." });
    try {
      const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
      res.status(201).json({ token: sign(user), user: publicUser(user) });
    } catch (e) {
      if (e?.code === 11000) return res.status(409).json({ message: "That email already has an account." });
      throw e;
    }
  } catch (e) {
    next(e);
  }
});



router.post("/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: "Email or password is incorrect." });
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.get("/me", auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ message: "Account not found." });
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

export default router;
