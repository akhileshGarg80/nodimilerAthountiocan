import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './usermodel.js';

// Nodemailer Transporter Config
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Helper: 6-digit OTP generate karna
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// 1. REGISTER
export const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });

    if (user && user.isVerified) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min validity

    if (user && !user.isVerified) {
      user.password = hashedPassword;
      user.otp = otp;
      user.otpExpires = otpExpires;
    } else {
      user = new User({ email, password: hashedPassword, otp, otpExpires });
    }

    await user.save();

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Registration OTP Code',
      text: `Your Registration OTP is ${otp}. Valid for 10 minutes.`
    });

    res.status(201).json({ message: 'OTP sent to your email. Please verify.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 2. VERIFY REGISTRATION OTP (Auto Login)
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'OTP Verified successfully!', token, user: { id: user._id, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 3. LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Account not verified. Please complete registration.' });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful!', token, user: { id: user._id, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 4. FORGOT PASSWORD (SEND OTP)
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Password Reset OTP',
      text: `Your Password Reset OTP is ${otp}. Valid for 10 minutes.`
    });

    res.json({ message: 'Password reset OTP sent to your email.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 5. RESET PASSWORD WITH OTP (Auto Login)
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    user.otpExpires = undefined;
    user.isVerified = true;
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Password reset successful!', token, user: { id: user._id, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 6. PROFILE DATA
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};