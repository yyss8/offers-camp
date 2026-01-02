import nodemailer from 'nodemailer';

/**
 * Creates and configures the email transporter
 */
function createEmailTransporter() {
  const config = {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  };

  return nodemailer.createTransport(config);
}

/**
 * Sends a verification email with a 6-digit code
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.username - Username of the recipient
 * @param {string} options.code - 6-digit verification code
 * @returns {Promise<void>}
 */
export async function sendVerificationEmail({ to, username, code }) {
  const transporter = createEmailTransporter();
  const fromName = process.env.EMAIL_FROM_NAME || 'Offers Camp';
  // Use EMAIL_FROM for alias addresses (e.g., no-reply@offers.camp)
  // Fall back to EMAIL_USER if EMAIL_FROM is not set
  const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: 'Email Verification - Offers Camp',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #292524;
              margin: 0;
              padding: 0;
              background: linear-gradient(to bottom right, #fef3c7, #fed7aa, #fecaca);
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 40px 20px;
            }
            .card {
              background-color: rgba(255, 255, 255, 0.95);
              border-radius: 16px;
              padding: 40px;
              border: 1px solid #e7e5e4;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            }
            .logo {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo img {
              width: 200px;
              height: auto;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #292524;
              font-size: 24px;
              font-weight: 600;
              margin: 0;
            }
            .greeting {
              color: #57534e;
              font-size: 16px;
              margin-bottom: 20px;
            }
            .code-box {
              background: linear-gradient(to bottom right, #fef3c7, #fed7aa);
              border: 2px solid #f59e0b;
              border-radius: 12px;
              padding: 30px;
              text-align: center;
              margin: 30px 0;
            }
            .code {
              font-size: 36px;
              font-weight: bold;
              color: #292524;
              letter-spacing: 10px;
              font-family: 'Courier New', monospace;
            }
            .info {
              color: #78716c;
              font-size: 14px;
              margin-top: 20px;
              line-height: 1.8;
            }
            .info-item {
              margin: 8px 0;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e7e5e4;
              text-align: center;
              color: #a8a29e;
              font-size: 12px;
            }
            .footer p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="logo">
                <img src="https://offers.camp/images/logo.png" alt="Offers Camp" />
              </div>
              <div class="header">
                <h1>✉️ Email Verification</h1>
              </div>
              <p class="greeting">Hello <strong>${username}</strong>,</p>
              <p class="greeting">Thank you for registering with Offers Camp! Please use the following verification code to complete your email verification:</p>
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              <div class="info">
                <div class="info-item">⏰ This verification code will expire in <strong>15 minutes</strong></div>
                <div class="info-item">🔒 If you didn't request this, please ignore this email</div>
              </div>
              <div class="footer">
                <p>This is an automated message, please do not reply</p>
                <p>&copy; ${new Date().getFullYear()} Offers Camp. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hello ${username},

Thank you for registering with Offers Camp!

Your verification code is: ${code}

This code will expire in 15 minutes.

If you didn't request this, please ignore this email.

---
This is an automated message, please do not reply
© ${new Date().getFullYear()} Offers Camp. All rights reserved.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Verification email sent to ${to}`);
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error);
    throw error;
  }
}
