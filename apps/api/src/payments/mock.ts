import { validateCard } from "../lib/card.js";
import type { PaymentProvider, VerifyPayload, VerifyResult, OrderResult } from "./provider.js";

export const mockProvider: PaymentProvider = {
  name: "mock",

  async createOrder(amount: number, currency: string, _receipt: string): Promise<OrderResult> {
    const orderId = `order_mock_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { orderId, amount, currency };
  },

  async verify(payload: VerifyPayload): Promise<VerifyResult> {
    const { card, orderId } = payload;

    if (!card || !orderId) {
      return { ok: false, reason: "Mock provider requires card + orderId" };
    }

    // Decline test card: number ending in 0002
    const stripped = card.number.replace(/\s+/g, "");
    if (stripped.endsWith("0002")) {
      return { ok: false, reason: "Card declined (test)" };
    }

    const result = validateCard(card);
    if (!result.valid) {
      return { ok: false, reason: result.reason };
    }

    const paymentId = `pay_mock_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { ok: true, paymentId, method: "CARD", last4: result.last4 };
  },
};
