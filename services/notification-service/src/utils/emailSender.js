const nodemailer = require('nodemailer');
const { logger } = require('./logger');

// Create a transporter using SMTP
// You need to set these environment variables in your notification-service/.env file
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER, // e.g., your-email@gmail.com
    pass: process.env.SMTP_PASS, // e.g., your-app-password
  },
});

/**
 * Send an email notification
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text email body
 * @param {string} html - HTML email body (optional)
 */
const sendEmail = async (to, subject, text, html) => {
  // If SMTP configs are not provided, we only log
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('SMTP credentials not configured. Skipping email sending. To enable emails, add SMTP_USER and SMTP_PASS to notification-service/.env');
    return false;
  }

  if (!to) {
    logger.error(`Attempted to send email but 'to' address is missing. Subject: ${subject}`);
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"DoctorConnect" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html: html || text, // fallback to text if HTML not provided
    });

    logger.info(`Email sent successfully: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send email to ${to}:`, error);
    return false;
  }
};

module.exports = { sendEmail };
