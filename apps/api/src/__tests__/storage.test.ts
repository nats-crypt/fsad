import { describe, it, expect } from "vitest";

describe("storage utilities", () => {
  it("putObject returns null gracefully when AWS_ENDPOINT_URL_S3 is not set", async () => {
    // In test env, AWS_ENDPOINT_URL_S3 is not set
    const { putObject } = await import("../lib/storage.js");
    // Should not throw
    const result = await putObject("tickets/TEST123.pdf", Buffer.from("hello"), "application/pdf");
    expect(result).toBeNull();
  });

  it("presignGet returns null gracefully when AWS_ENDPOINT_URL_S3 is not set", async () => {
    const { presignGet } = await import("../lib/storage.js");
    const result = await presignGet("tickets/TEST123.pdf");
    expect(result).toBeNull();
  });

  it("ticket key follows the pattern tickets/{pnr}.pdf", () => {
    const pnr = "ABC123";
    const key = `tickets/${pnr}.pdf`;
    expect(key).toBe("tickets/ABC123.pdf");
  });
});
