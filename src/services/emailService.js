// ===========================================
// EMAIL SERVICE - Nodemailer
// ===========================================

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Email templates
const templates = {
  'verify-email': (data) => ({
    subject: 'Verify your Find My Dog account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f97316;">Welcome to Find My Dog! 🐕</h1>
        <p>Hi ${data.name},</p>
        <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
        <a href="${data.verifyUrl}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">Verify Email</a>
        <p>If you didn't create an account, you can safely ignore this email.</p>
        <p>Best,<br>The Find My Dog Team</p>
      </div>
    `
  }),
  
  'reset-password': (data) => ({
    subject: 'Reset your Find My Dog password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f97316;">Password Reset Request</h1>
        <p>Hi ${data.name},</p>
        <p>You requested to reset your password. Click the button below to set a new password:</p>
        <a href="${data.resetUrl}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>Best,<br>The Find My Dog Team</p>
      </div>
    `
  }),
  
  'sighting-alert': (data) => ({
    subject: `🐕 New sighting of ${data.dogName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f97316;">New Sighting Alert!</h1>
        <p>Hi ${data.ownerName},</p>
        <p>Great news! Someone just reported a sighting of <strong>${data.dogName}</strong>.</p>
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Location:</strong> ${data.location}</p>
          <p><strong>Time:</strong> ${data.time}</p>
          ${data.details ? `<p><strong>Details:</strong> ${data.details}</p>` : ''}
        </div>
        <a href="${data.viewUrl}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">View Details</a>
        <p>Best,<br>The Find My Dog Team</p>
      </div>
    `
  }),
  
  'bounty-claim': (data) => ({
    subject: `🎉 Someone found ${data.dogName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #22c55e;">Bounty Claim Received!</h1>
        <p>Hi ${data.ownerName},</p>
        <p>Someone has submitted a claim that they found <strong>${data.dogName}</strong>!</p>
        <div style="background: #dcfce7; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Claimant:</strong> ${data.claimantName}</p>
          <p><strong>Current Location:</strong> ${data.location}</p>
          <p><strong>Contact:</strong> ${data.contactPhone}</p>
        </div>
        <p>Please review the claim and arrange a meeting to verify. Once confirmed, you can release the $${data.bountyAmount} bounty through the app.</p>
        <a href="${data.reviewUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">Review Claim</a>
        <p>Best,<br>The Find My Dog Team</p>
      </div>
    `
  })
};

// Send email function
exports.sendEmail = async ({ to, subject, template, data, html }) => {
  try {
    let emailContent;
    
    if (template && templates[template]) {
      emailContent = templates[template](data);
    } else {
      emailContent = { subject, html };
    }
    
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: emailContent.subject,
      html: emailContent.html
    });
    
    logger.info(`Email sent: ${info.messageId} to ${to}`);
    return info;
  } catch (error) {
    logger.error('Send email error:', error);
    throw error;
  }
};
