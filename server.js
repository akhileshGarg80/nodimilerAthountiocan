import 'dotenv/config'; // <-- Sabse UPAR hona chahiye! Isse imports load hone se pehle .env read ho jayega
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import authRoutes from './feature/auth/route.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ---------------- Middleware ----------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- Routes ----------------
app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server chal raha hai' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route nahi mila' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Kuch galat ho gaya' });
});

// ---------------- Start Server ----------------
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server http://localhost:${PORT} par chal raha hai`);
  });
};

startServer();