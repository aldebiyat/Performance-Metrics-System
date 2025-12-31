import nodemailer from 'nodemailer';
import logger from '../config/logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const emailService = {
  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@benchmetrics.com',
      to,
      subject: 'Reset Your Password - Performance Metrics',
      html: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    logger.info('Password reset email sent', { to });
  },

  async sendVerificationEmail(to: string, verificationToken: string): Promise<void> {
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@benchmetrics.com',
      to,
      subject: 'Verify Your Email - Performance Metrics',
      html: `
        <h1>Welcome!</h1>
        <p>Click the link below to verify your email:</p>
        <a href="${verifyUrl}">Verify Email</a>
      `,
    });

    logger.info('Verification email sent', { to });
  },
};
