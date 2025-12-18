import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "./config.js";
import type Mail from "nodemailer/lib/mailer/index.js";

let transporter: Transporter | null = null;

/**
 * Initialize the email transporter with SMTP configuration
 */
const initializeTransporter = (): Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.smtpHost,
      port: config.email.smtpPort,
      secure: config.email.smtpSecure, // true for 465, false for other ports
      auth: {
        user: config.email.smtpUser,
        pass: config.email.smtpPassword,
      },
    });
  }
  return transporter;
};

/**
 * Send an email
 */
export const sendEmail = async (options: {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}): Promise<void> => {
  const transporter = initializeTransporter();

  const mailOptions: Mail.Options = {
    from: `"ALRT Support" <${config.email.fromAddress}>`,
    to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
    cc: options.cc
      ? Array.isArray(options.cc)
        ? options.cc.join(", ")
        : options.cc
      : undefined,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Verify email configuration
 */
export const verifyEmailConfig = async (): Promise<boolean> => {
  try {
    const transporter = initializeTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error("Email configuration verification failed:", error);
    return false;
  }
};
