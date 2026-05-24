const nodemailer = require("nodemailer");

// Create a transporter configuration using standard SMTP (often Gmail for testing).
// You must provide EMAIL_USER and EMAIL_PASS in your backend/.env file.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || "",
  },
});

/**
 * Sends a 6-digit OTP code to the requested email.
 * @param {string} toEmail - The recipient's email address
 * @param {string} otpCode - The 6-digit login code
 * @returns {Promise<boolean>} - Resolves to true if sent successfully
 */
const sendOtpEmail = async (toEmail, otpCode) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("Mailer Error: Missing EMAIL_USER or EMAIL_PASS in .env");
    return false;
  }

  const mailOptions = {
    from: `"SyntaxSquad Invoice Analyzer" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Your Invoice Analyzer Login Code",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #0891b2; margin-top: 0;">Login Request</h2>
        <p style="color: #374151; font-size: 16px;">
          You requested to log in to SyntaxSquad AI Invoice Analyzer. Use the following 6-digit code to complete your login. 
        </p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #111827;">${otpCode}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          This code will expire in 10 minutes. If you did not request this code, please ignore this email.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP Email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error("Mailer Error: Failed to send OTP email.", error);
    return false;
  }
};

module.exports = {
  sendOtpEmail,
};
