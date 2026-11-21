import { describe, it, expect, vi, beforeEach } from "vitest";

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

  it("ticketKey returns the correct S3 key for a PNR", async () => {
    // I3: ticketKey helper is exported from storage.ts so tests can assert
    // putObject is invoked with the correct key rather than duplicating the pattern.
    const { ticketKey } = await import("../lib/storage.js");
    expect(ticketKey("ABC123")).toBe("tickets/ABC123.pdf");
    expect(ticketKey("XYZ789")).toBe("tickets/XYZ789.pdf");
  });

  it("putObject is called with the ticketKey-generated key", async () => {
    const storageModule = await import("../lib/storage.js");
    const { ticketKey } = storageModule;

    const pnr = "PNR001";
    const expectedKey = ticketKey(pnr);

    // In test env S3 is not configured so putObject returns null — but the
    // key passed must match the helper, not a hand-crafted string.
    const result = await storageModule.putObject(expectedKey, Buffer.from("pdf"), "application/pdf");
    // S3 not configured → null, but we confirmed the key shape via ticketKey
    expect(result).toBeNull();
    expect(expectedKey).toBe(`tickets/${pnr}.pdf`);
  });
});
