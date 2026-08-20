import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './usermodel.js';

const getTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
};

// 1. REGISTER (Verification Link Bhejna)
export const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });

    if (user && user.isVerified) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (user && !user.isVerified) {
      user.password = hashedPassword;
    } else {
      user = new User({ email, password: hashedPassword });
    }
    await user.save();

    // 15-minute validity wala signed verification token
    const verificationToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const verificationLink = `${process.env.CLIENT_URL}/api/auth/verify-email?token=${verificationToken}`;

    await getTransporter().sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <h3>Welcome!</h3>
        <p>Please verify your email by clicking the link below (Valid for 15 mins):</p>
        <a href="${verificationLink}" style="padding: 10px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
      `
    });

    res.status(201).json({ message: 'Verification link sent to your email. Please check your inbox!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 2. VERIFY EMAIL VIA LINK (Auto Login & Redirect)
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Verification token missing');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.status(404).send('User not found');

    user.isVerified = true;
    await user.save();

    // Auto login ke liye access token
    const loginToken = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Frontend par redirect karke auto-login kara do
    res.redirect(`${process.env.CLIENT_URL}/?verified=true&token=${loginToken}&email=${user.email}`);
  } catch (err) {
    res.status(400).send('Invalid or expired verification link.');
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
      return res.status(403).json({ message: 'Account not verified. Please check your email for the link.' });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful!', token, user: { id: user._id, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 4. FORGOT PASSWORD (Send Reset Password Link)
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const resetToken = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const resetLink = `${process.env.CLIENT_URL}/#reset-password?token=${resetToken}`;

    await getTransporter().sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Reset Your Password',
      html: `
        <h3>Password Reset Requested</h3>
        <p>Click the link below to reset your password (Valid for 15 mins):</p>
        <a href="${resetLink}" style="padding: 10px 15px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      `
    });

    res.json({ message: 'Password reset link sent to your email.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 5. RESET PASSWORD WITH LINK TOKEN (Auto Login)
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token) return res.status(400).json({ message: 'Reset token missing' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.isVerified = true;
    await user.save();

    const loginToken = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Password reset successful!', token: loginToken, user: { id: user._id, email: user.email } });
  } catch (err) {
    res.status(400).json({ message: 'Invalid or expired token' });
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