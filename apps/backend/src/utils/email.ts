import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
});

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!config.SMTP_HOST) {
    console.log(`[EMAIL SKIPPED — no SMTP] To: ${to} | ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: config.EMAIL_FROM, to, subject, html });
  } catch (err) {
    console.error(`[EMAIL ERROR] To: ${to} | ${subject}`, err);
  }
}
