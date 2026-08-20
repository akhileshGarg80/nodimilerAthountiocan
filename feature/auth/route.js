import express from 'express';
import {
  registerUser,
  verifyOtp,
  resendOtp,
  loginUser,
  getMe,
} from './controller.js';
import { protect } from './middleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', loginUser);
router.get('/me', protect, getMe);

export default router;