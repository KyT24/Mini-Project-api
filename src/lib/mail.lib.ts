import 'dotenv/config';
import nodemailer from 'nodemailer';
import { AppError } from '../errors/app.error';

const getTransport = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new AppError(500, 'email service is not configured');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
};

export class Mail {
  static async sendPasswordReset(to: string, resetUrl: string) {
    await getTransport().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Reset password akun Anda',
      text: `Buka link berikut untuk membuat password baru: ${resetUrl}\n\nLink berlaku 15 menit. Abaikan email ini bila Anda tidak memintanya.`,
      html: `<p>Klik link berikut untuk membuat password baru:</p><p><a href="${resetUrl}">Reset password</a></p><p>Link berlaku 15 menit. Abaikan email ini bila Anda tidak memintanya.</p>`,
    });
  }
}
