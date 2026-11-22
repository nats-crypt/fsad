import nodemailer from "nodemailer";

function createTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const transport = createTransport();
  if (!transport) return false;
  try {
    await transport.sendMail({
      from: `"Horizon Airways" <${process.env.GMAIL_USER}>`,
      ...opts,
    });
    return true;
  } catch (err) {
    console.error("[mailer] failed to send:", err);
    return false;
  }
}

export function isMailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}
