import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './feature/auth/route.js';

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);

// Embedded Frontend HTML (No public folder required, zero '#' hashes)
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auth System</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    body { background-color: #f4f7f6; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
    .card { background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); width: 100%; max-width: 400px; }
    h2 { font-size: 22px; margin-bottom: 15px; color: #333; text-align: center; }
    h3 { font-size: 18px; margin-bottom: 15px; color: #444; }
    input { width: 100%; padding: 12px; margin: 8px 0 16px 0; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; outline: none; }
    button { width: 100%; padding: 12px; background-color: #007bff; color: white; border: none; border-radius: 6px; font-size: 15px; font-weight: bold; cursor: pointer; }
    button:disabled { background-color: #a0c4ff; cursor: not-allowed; }
    .logout-btn { background-color: #dc3545; }
    p { font-size: 14px; color: #666; margin-top: 12px; text-align: center; }
    a { color: #007bff; text-decoration: none; font-weight: 600; }
    .hidden { display: none !important; }
    #message { padding: 10px; margin-bottom: 15px; border-radius: 6px; font-size: 14px; text-align: center; display: none; }
    .msg-success { background-color: #d4edda; color: #155724; display: block !important; }
    .msg-error { background-color: #f8d7da; color: #721c24; display: block !important; }
  </style>
</head>
<body>

  <div class="card">
    <h2>Auth System</h2>
    <div id="message"></div>

    <!-- Register Box -->
    <div id="registerBox" class="box">
      <h3>Register</h3>
      <input type="email" id="regEmail" placeholder="Enter your email" required>
      <input type="password" id="regPassword" placeholder="Enter password" required>
      <button id="regBtn" onclick="handleRegister()">Send Verification Link</button>
      <p>Already have an account? <a href="#" onclick="showBox('loginBox'); return false;">Login</a></p>
    </div>

    <!-- Login Box -->
    <div id="loginBox" class="box hidden">
      <h3>Login</h3>
      <input type="email" id="loginEmail" placeholder="Enter email" required>
      <input type="password" id="loginPassword" placeholder="Enter password" required>
      <button id="loginBtn" onclick="handleLogin()">Login</button>
      <p><a href="#" onclick="showBox('forgotBox'); return false;">Forgot Password?</a></p>
      <p>Need an account? <a href="#" onclick="showBox('registerBox'); return false;">Register</a></p>
    </div>

    <!-- Forgot Password Box -->
    <div id="forgotBox" class="box hidden">
      <h3>Forgot Password</h3>
      <input type="email" id="forgotEmail" placeholder="Enter registered email" required>
      <button id="forgotBtn" onclick="handleForgotPassword()">Send Reset Link</button>
      <p><a href="#" onclick="showBox('loginBox'); return false;">Back to Login</a></p>
    </div>

    <!-- Reset Password Box -->
    <div id="resetBox" class="box hidden">
      <h3>Set New Password</h3>
      <input type="password" id="newPassword" placeholder="Enter new password" required>
      <button id="resetBtn" onclick="handleResetPassword()">Reset & Auto Login</button>
    </div>

    <!-- Profile Box -->
    <div id="profileBox" class="box hidden">
      <h3>User Profile</h3>
      <p style="text-align: left; margin-bottom: 20px;"><strong>Email:</strong> <span id="profileEmail"></span></p>
      <button onclick="handleLogout()" class="logout-btn">Logout</button>
    </div>
  </div>

  <script>
    const API = '/api/auth';
    let resetTokenFromUrl = '';

    function showBox(boxId) {
      ['registerBox', 'loginBox', 'forgotBox', 'resetBox', 'profileBox'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
      });
      document.getElementById(boxId).classList.remove('hidden');
      hideMessage();
    }

    function setMessage(text, isError = false) {
      const msgDiv = document.getElementById('message');
      msgDiv.innerText = text;
      msgDiv.className = isError ? 'msg-error' : 'msg-success';
    }

    function hideMessage() {
      const msgDiv = document.getElementById('message');
      msgDiv.innerText = '';
      msgDiv.className = '';
    }

    function setLoading(btnId, isLoading) {
      const btn = document.getElementById(btnId);
      if (isLoading) {
        btn.disabled = true;
        btn.dataset.originalText = btn.innerText;
        btn.innerText = 'Please wait...';
      } else {
        btn.disabled = false;
        btn.innerText = btn.dataset.originalText || 'Submit';
      }
    }

    function saveTokenAndShowProfile(token, email) {
      localStorage.setItem('token', token);
      document.getElementById('profileEmail').innerText = email;
      showBox('profileBox');
    }

    async function handleRegister() {
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      if (!email || !password) return setMessage('Please fill all fields', true);

      setLoading('regBtn', true);
      try {
        const res = await fetch(\`\${API}/register\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        setMessage(data.message, !res.ok);
      } catch (err) {
        setMessage('Server network error. Please try again.', true);
      } finally {
        setLoading('regBtn', false);
      }
    }

    async function handleLogin() {
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (!email || !password) return setMessage('Please fill all fields', true);

      setLoading('loginBtn', true);
      try {
        const res = await fetch(\`\${API}/login\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        setMessage(data.message, !res.ok);
        if (res.ok) saveTokenAndShowProfile(data.token, data.user.email);
      } catch (err) {
        setMessage('Server network error. Please try again.', true);
      } finally {
        setLoading('loginBtn', false);
      }
    }

    async function handleForgotPassword() {
      const email = document.getElementById('forgotEmail').value.trim();
      if (!email) return setMessage('Please enter email', true);

      setLoading('forgotBtn', true);
      try {
        const res = await fetch(\`\${API}/forgot-password\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        setMessage(data.message, !res.ok);
      } catch (err) {
        setMessage('Server network error. Please try again.', true);
      } finally {
        setLoading('forgotBtn', false);
      }
    }

    async function handleResetPassword() {
      const newPassword = document.getElementById('newPassword').value;
      if (!newPassword) return setMessage('Please enter new password', true);

      setLoading('resetBtn', true);
      try {
        const res = await fetch(\`\${API}/reset-password\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetTokenFromUrl, newPassword })
        });
        const data = await res.json();
        setMessage(data.message, !res.ok);
        if (res.ok) saveTokenAndShowProfile(data.token, data.user.email);
      } catch (err) {
        setMessage('Server network error. Please try again.', true);
      } finally {
        setLoading('resetBtn', false);
      }
    }

    function handleLogout() {
      localStorage.removeItem('token');
      window.location.href = '/';
    }

    window.onload = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isVerified = urlParams.get('verified');
      const verifiedToken = urlParams.get('token');
      const email = urlParams.get('email');
      const resetToken = urlParams.get('resetToken');

      if (isVerified === 'true' && verifiedToken) {
        window.history.replaceState({}, document.title, "/");
        saveTokenAndShowProfile(verifiedToken, email);
        setMessage('Email verified successfully! You are logged in.');
        return;
      }

      if (resetToken) {
        resetTokenFromUrl = resetToken;
        showBox('resetBox');
        return;
      }

      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await fetch(\`\${API}/profile\`, {
            headers: { 'Authorization': \`Bearer \${token}\` }
          });
          if (res.ok) {
            const data = await res.json();
            document.getElementById('profileEmail').innerText = data.user.email;
            showBox('profileBox');
          } else {
            localStorage.removeItem('token');
            showBox('loginBox');
          }
        } catch (err) {
          showBox('loginBox');
        }
      } else {
        showBox('loginBox');
      }
    };
  </script>
</body>
</html>
`;

// Catch-All Wildcard Route to serve embedded HTML
app.use((req, res) => {
  res.send(htmlContent);
});

connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));