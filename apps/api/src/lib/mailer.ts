import { Resend } from "resend";

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  try {
    await client.emails.send({
      from: "Horizon Airways <onboarding@resend.dev>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
      })),
    });
    return true;
  } catch (err) {
    console.error("[mailer] failed to send:", err);
    return false;
  }
}

export function isMailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
