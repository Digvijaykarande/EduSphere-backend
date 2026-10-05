import nodemailer from "nodemailer";
import env from "../config/env.js";

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  } else {
    console.log(
      "⚠️ No SMTP config found in .env. Creating Ethereal test account..."
    );
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  return transporter;
}

function logPreviewIfAny(info) {
  if (info && info.messageId && nodemailer.getTestMessageUrl(info)) {
    console.log(`📧 Test Email Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }
}

/**
 * Verification email — sent to `contactEmail` when a principal invites a
 * teacher or student. Contains the unhashed token in the URL; only the
 * sha256 hash is stored in DB.
 */
export async function sendVerificationEmail({ to, name, role, verifyUrl }) {
  try {
    const transport = await getTransporter();
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5;">Verify your EduSphere account</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>You have been added as a <strong>${role}</strong> on EduSphere. Please verify your email to activate the account. This link is valid for <strong>24 hours</strong>.</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${verifyUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Verify email
          </a>
        </p>
        <p>If the button doesn't work, paste this URL into your browser:</p>
        <div style="background-color: #F3F4F6; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 13px;">
          ${verifyUrl}
        </div>
        <p>If you did not expect this email, please ignore it.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">EduSphere SaaS Platform</p>
      </div>
    `;

    const info = await transport.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject: "Verify your EduSphere account",
      html,
    });
    logPreviewIfAny(info);
    return info;
  } catch (error) {
    console.error("❌ Failed to send verification email:", error);
    throw new Error(`Email could not be sent: ${error.message}`);
  }
}

/**
 * Welcome email — sent after verification. Contains the login alias and the
 * temporary password. This is the ONLY place the temp password is exposed.
 */
export async function sendWelcomeEmail({
  to,
  name,
  role,
  alias,
  tempPassword,
  loginUrl,
}) {
  try {
    const transport = await getTransporter();
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5;">Welcome to EduSphere, ${name}!</h2>
        <p>Your ${role} account is now active. Here is how to sign in:</p>
        <div style="background-color: #F3F4F6; padding: 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Login ID (alias):</strong> <span style="font-family: monospace;">${alias}</span></p>
          <p style="margin: 4px 0;"><strong>Temporary password:</strong> <span style="font-family: monospace; color: #DC2626;">${tempPassword}</span></p>
        </div>
        <p>You will be prompted to change your temporary password on first login.</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${loginUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Open EduSphere
          </a>
        </p>
        <p style="font-size: 13px; color: #555;">Note: the login ID above is for display only. Mail will always come to this address (${to}).</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">EduSphere SaaS Platform</p>
      </div>
    `;
    const info = await transport.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject: "Welcome to EduSphere — your account is ready",
      html,
    });
    logPreviewIfAny(info);
    return info;
  } catch (error) {
    console.error("❌ Failed to send welcome email:", error);
    return null;
  }
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  try {
    const transport = await getTransporter();
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5;">Password Reset Request</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>You requested to reset your password for your EduSphere account. Click the button below to choose a new one. The link is valid for <strong>1 hour</strong>.</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Reset password
          </a>
        </p>
        <p>If the button doesn't work, paste this URL into your browser:</p>
        <div style="background-color: #F3F4F6; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 13px;">
          ${resetUrl}
        </div>
        <p>If you did not request a password reset, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">EduSphere SaaS Platform</p>
      </div>
    `;
    const info = await transport.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject: "EduSphere - Reset Your Password",
      html,
    });
    logPreviewIfAny(info);
    return info;
  } catch (error) {
    console.error("❌ Failed to send password reset email:", error);
    throw new Error(`Email could not be sent: ${error.message}`);
  }
}