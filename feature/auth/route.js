import express from 'express';
import { register, verifyEmail, login, forgotPassword, resetPassword, getProfile } from './controller.js';
import { authenticate } from './middleware.js';

const router = express.Router();

router.post('/register', register);
router.get('/verify-email', verifyEmail);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/profile', authenticate, getProfile);

export default router;