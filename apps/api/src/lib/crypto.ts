// AES-256-GCM encryption for PII fields (passport number, etc.)
// Key must be 32 bytes. Derived from JWT_SECRET via SHA-256 so no extra env var needed.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET ?? "horizon-dev-secret";
  return createHash("sha256").update(secret).digest();
}

const ALGO = "aes-256-gcm";

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(hex):tag(hex):ciphertext(hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(stored: string): string {
  const [ivHex, tagHex, ctHex] = stored.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
