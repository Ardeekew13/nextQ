import nodemailer from "nodemailer";

/**
 * Minimal SMTP-based mailer, configured entirely through env vars so any
 * provider (Resend, SendGrid, AWS SES, Mailgun, plain Gmail SMTP, etc.) can be
 * plugged in without code changes:
 *
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 *
 * If those aren't set (e.g. in local dev before you've picked a provider),
 * emails are logged to the console instead of sent, so the reset flow is
 * still fully testable without signing up for anything.
 */
function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = "Reset your NextQ password";
  const text = `We received a request to reset your NextQ password.\n\nReset it here (this link expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;
  const html = `
    <p>We received a request to reset your NextQ password.</p>
    <p><a href="${resetUrl}" style="background:#f43f75;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;display:inline-block;">Reset password</a></p>
    <p>Or copy this link (expires in 1 hour):<br/>${resetUrl}</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `;

  const transport = getTransport();
  if (!transport) {
    // No email provider configured yet — log it so the flow is still usable in dev.
    console.log(`[email:dev-fallback] Password reset link for ${to}:\n${resetUrl}`);
    return;
  }

  await transport.sendMail({
    from: process.env.EMAIL_FROM || "NextQ <no-reply@nextq.app>",
    to,
    subject,
    text,
    html,
  });
}
