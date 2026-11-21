import { describe, it, expect } from "vitest";
import { validateCard } from "../lib/card.js";

describe("validateCard", () => {
  it("accepts a valid Luhn card number with future expiry and valid CVV", () => {
    const result = validateCard({
      number: "4539148803436467",
      expiry: "12/30",
      cvv: "123",
    });
    expect(result.valid).toBe(true);
    expect(result.last4).toBe("6467");
  });

  it("rejects a card with invalid Luhn checksum", () => {
    const result = validateCard({
      number: "1234567890123456",
      expiry: "12/30",
      cvv: "123",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("rejects a 15-digit card number", () => {
    const result = validateCard({
      number: "453914880343646",
      expiry: "12/30",
      cvv: "123",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/16 digit/i);
  });

  it("rejects a card with a past expiry date", () => {
    const result = validateCard({
      number: "4539148803436467",
      expiry: "01/20",
      cvv: "123",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expir/i);
  });

  it("rejects a non-3-digit CVV", () => {
    const result = validateCard({
      number: "4539148803436467",
      expiry: "12/30",
      cvv: "12",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/cvv/i);
  });

  it("detects Visa brand from BIN starting with 4", () => {
    const result = validateCard({
      number: "4539148803436467",
      expiry: "12/30",
      cvv: "123",
    });
    expect(result.valid).toBe(true);
    expect(result.brand).toBe("VISA");
  });
});
