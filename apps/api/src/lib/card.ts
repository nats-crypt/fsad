export interface CardInput {
  number: string;
  expiry: string; // MM/YY
  cvv: string;
}

export interface CardResult {
  valid: boolean;
  last4?: string;
  brand?: string;
  reason?: string;
}

/** Luhn algorithm check */
function luhn(num: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num[i], 10);
    if (alt) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Detect card brand from BIN prefix */
function detectBrand(num: string): string | undefined {
  if (/^4/.test(num)) return "VISA";
  if (/^5[1-5]/.test(num)) return "MASTERCARD";
  if (/^3[47]/.test(num)) return "AMEX";
  if (/^6(?:011|5)/.test(num)) return "DISCOVER";
  if (/^35[2-8]\d/.test(num)) return "JCB";
  return undefined;
}

export function validateCard(input: CardInput): CardResult {
  const { number, expiry, cvv } = input;
  const stripped = number.replace(/\s+/g, "");

  if (!/^\d{16}$/.test(stripped)) {
    return { valid: false, reason: "Card number must be 16 digits" };
  }

  if (!luhn(stripped)) {
    return { valid: false, reason: "Card number failed Luhn check" };
  }

  // Validate expiry MM/YY
  if (!/^\d{2}\/\d{2}$/.test(expiry)) {
    return { valid: false, reason: "Expiry must be MM/YY" };
  }
  const [mm, yy] = expiry.split("/").map(Number);
  if (mm < 1 || mm > 12) {
    return { valid: false, reason: "Invalid expiry month" };
  }
  const now = new Date();
  const expYear = 2000 + yy;
  const expMonth = mm; // 1-based
  if (
    expYear < now.getFullYear() ||
    (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)
  ) {
    return { valid: false, reason: "Card is expired" };
  }

  // Validate CVV (3 digits)
  if (!/^\d{3}$/.test(cvv)) {
    return { valid: false, reason: "CVV must be 3 digits" };
  }

  const last4 = stripped.slice(-4);
  const brand = detectBrand(stripped);

  return { valid: true, last4, brand };
}
