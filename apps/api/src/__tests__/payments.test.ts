import { describe, it, expect } from "vitest";
import { getPaymentProvider } from "../payments/provider.js";

describe("Payment Provider", () => {
  it("returns mock provider when no Razorpay env vars are set", () => {
    // .env.test has no RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET
    const provider = getPaymentProvider();
    expect(provider.name).toBe("mock");
  });

  it("mock createOrder returns an orderId and amount", async () => {
    const provider = getPaymentProvider();
    const order = await provider.createOrder(500000, "INR", "receipt_001");
    expect(order.orderId).toMatch(/^order_mock_/);
    expect(order.amount).toBe(500000);
    expect(order.currency).toBe("INR");
  });

  it("mock verify accepts a valid Luhn card", async () => {
    const provider = getPaymentProvider();
    const order = await provider.createOrder(500000, "INR", "receipt_002");
    const result = await provider.verify({
      orderId: order.orderId,
      card: { number: "4539148803436467", expiry: "12/30", cvv: "123" },
    });
    expect(result.ok).toBe(true);
    expect(result.paymentId).toMatch(/^pay_mock_/);
    expect(result.last4).toBe("6467");
  });

  it("mock verify rejects the decline test card (ending in 0002)", async () => {
    const provider = getPaymentProvider();
    const order = await provider.createOrder(500000, "INR", "receipt_003");
    const result = await provider.verify({
      orderId: order.orderId,
      card: { number: "4111111111110002", expiry: "12/30", cvv: "123" },
    });
    expect(result.ok).toBe(false);
  });

  it("mock verify rejects an invalid Luhn card", async () => {
    const provider = getPaymentProvider();
    const order = await provider.createOrder(500000, "INR", "receipt_004");
    const result = await provider.verify({
      orderId: order.orderId,
      card: { number: "1234567890123456", expiry: "12/30", cvv: "999" },
    });
    expect(result.ok).toBe(false);
  });
});
