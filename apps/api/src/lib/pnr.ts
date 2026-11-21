/** Generates a 6-character uppercase alphanumeric PNR */
export function genPnr(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pnr = "";
  for (let i = 0; i < 6; i++) {
    pnr += chars[Math.floor(Math.random() * chars.length)];
  }
  return pnr;
}
