import express from 'express';
import { register, verifyOtp, login, forgotPassword, resetPassword, getProfile } from './controller.js';
import { authenticate } from './middleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/profile', authenticate, getProfile);

export default router;