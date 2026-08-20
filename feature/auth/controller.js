import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './usermodel.js';
import { sendOtpEmail } from './mailer.js';

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 5;
const SALT_ROUNDS = 10;

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// ---------------- REGISTER ----------------
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Sabhi fields required hain' });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.isVerified) {
      return res.status(409).json({ success: false, message: 'Email already registered hai' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);

    let user;
    if (existingUser && !existingUser.isVerified) {
      // Pehle se unverified user hai — update kar do (resend jaisa)
      existingUser.name = name;
      existingUser.password = hashedPassword;
      existingUser.otp = otp;
      existingUser.otpExpiry = otpExpiry;
      existingUser.otpAttempts = 0;
      user = await existingUser.save();
    } else {
      user = await User.create({
        name,
        email,
        password: hashedPassword,
        otp,
        otpExpiry,
      });
    }

    // Email async bhej rahe hain, response ko block nahi karte (ultra fast response)
    sendOtpEmail(email, otp).catch((err) =>
      console.error('OTP email send failed:', err.message)
    );

    return res.status(201).json({
      success: true,
      message: 'OTP aapke email par bhej diya gaya hai',
      userId: user._id,
    });
  } catch (error) {
    console.error('Register Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------------- VERIFY OTP ----------------
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email aur OTP zaroori hain' });
    }

    const user = await User.findOne({ email }).select('+otp +otpExpiry +otpAttempts');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User nahi mila' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'User already verified hai' });
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Bahut zyada galat attempts. Naya OTP mangwayein',
      });
    }

    if (!user.otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expire ho chuka hai' });
    }

    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ success: false, message: 'Galat OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpAttempts = 0;
    await user.save();

    const token = signToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Verification successful',
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error('Verify OTP Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------------- RESEND OTP ----------------
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email zaroori hai' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User nahi mila' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'User already verified hai' });
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);
    user.otpAttempts = 0;
    await user.save();

    sendOtpEmail(email, otp).catch((err) =>
      console.error('OTP email send failed:', err.message)
    );

    return res.status(200).json({ success: true, message: 'Naya OTP bhej diya gaya hai' });
  } catch (error) {
    console.error('Resend OTP Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------------- LOGIN ----------------
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email aur password zaroori hain' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Pehle email verify karein' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error('Login Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------------- GET CURRENT USER (protected) ----------------
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User nahi mila' });
    }
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('GetMe Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};