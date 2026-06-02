import nodemailer from "nodemailer";

// Gmail transport using an App Password (requires 2FA on the Gmail account).
// Configured via env vars; if absent, sendResetEmail throws so the caller can
// surface a clear error instead of silently failing.
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error(
      "Email is not configured (GMAIL_USER / GMAIL_APP_PASSWORD missing)",
    );
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
}

export async function sendResetEmail(to: string, resetUrl: string, fullName: string) {
  const tx = getTransporter();
  const safeName = fullName || "there";
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
    <div style="font-size:22px;font-weight:800;background:linear-gradient(90deg,#7c3aed,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:16px">math.az</div>
    <h1 style="font-size:20px;margin:0 0 12px">Reset your password</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 8px">Hi ${safeName},</p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 20px">We received a request to reset your math.az password. Click the button below to choose a new one. This link expires in 1 hour and can be used once.</p>
    <a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;font-size:15px">Reset password</a>
    <p style="font-size:13px;line-height:1.5;color:#6b7280;margin:24px 0 0">If the button doesn't work, paste this link into your browser:</p>
    <p style="font-size:13px;line-height:1.5;word-break:break-all;color:#7c3aed;margin:4px 0 0">${resetUrl}</p>
    <p style="font-size:13px;line-height:1.5;color:#6b7280;margin:24px 0 0">If you didn't request this, you can safely ignore this email — your password stays unchanged.</p>
  </div>`;
  await tx.sendMail({
    from: `"math.az" <${GMAIL_USER}>`,
    to,
    subject: "Reset your math.az password",
    html,
    text: `Hi ${safeName},\n\nReset your math.az password using this link (expires in 1 hour, single use):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
  });
}
