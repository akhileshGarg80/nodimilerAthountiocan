import nodemailer from 'nodemailer';

// Quick check: Credentials load ho rahe hain ya nahi dekhne ke liye
if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  console.error('❌ GMAIL_USER ya GMAIL_APP_PASSWORD .env file mein nahi mila!');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

export const sendOtpEmail = async (toEmail, otp) => {
  const mailOptions = {
    from: `"Verification" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Your OTP Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2>Email Verification</h2>
        <p>Aapka OTP code hai:</p>
        <h1 style="letter-spacing: 6px;">${otp}</h1>
        <p>Yeh code 5 minute mein expire ho jayega. Agar aapne yeh request nahi ki, toh is email ko ignore karein.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

export default transporter;