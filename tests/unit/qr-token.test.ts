import { describe, it, expect, beforeAll, vi } from "vitest";
import { generateCurrentQrToken, verifyQrToken } from "@/lib/services/qr-token";

beforeAll(() => {
  process.env.QR_SECRET = "test-secret-do-not-use-in-production";
});

describe("generateCurrentQrToken", () => {
  it("produces a token, bucket, and expiry for a gym", () => {
    const payload = generateCurrentQrToken("gym-1");
    expect(payload.gymId).toBe("gym-1");
    expect(payload.token).toHaveLength(24);
    expect(payload.expiresAt).toBeGreaterThan(Date.now());
  });

  it("produces different tokens for different gyms at the same instant", () => {
    const a = generateCurrentQrToken("gym-1");
    const b = generateCurrentQrToken("gym-2");
    expect(a.token).not.toBe(b.token);
  });

  it("throws if QR_SECRET is not configured", () => {
    const original = process.env.QR_SECRET;
    delete process.env.QR_SECRET;
    expect(() => generateCurrentQrToken("gym-1")).toThrow("QR_SECRET is not configured.");
    process.env.QR_SECRET = original;
  });
});

describe("verifyQrToken", () => {
  it("accepts a freshly generated token for the same gym", () => {
    const payload = generateCurrentQrToken("gym-1");
    expect(verifyQrToken("gym-1", payload.bucket, payload.token)).toBe(true);
  });

  it("rejects a token scanned for the wrong gym", () => {
    const payload = generateCurrentQrToken("gym-1");
    expect(verifyQrToken("gym-2", payload.bucket, payload.token)).toBe(false);
  });

  it("rejects a tampered token of the same length", () => {
    const payload = generateCurrentQrToken("gym-1");
    const tampered = payload.token.slice(0, -1) + (payload.token.at(-1) === "0" ? "1" : "0");
    expect(verifyQrToken("gym-1", payload.bucket, tampered)).toBe(false);
  });

  it("rejects a token with a mismatched length", () => {
    const payload = generateCurrentQrToken("gym-1");
    expect(verifyQrToken("gym-1", payload.bucket, payload.token.slice(0, 10))).toBe(false);
  });

  it("rejects a token from a future bucket (clock manipulation attempt)", () => {
    const payload = generateCurrentQrToken("gym-1");
    expect(verifyQrToken("gym-1", payload.bucket + 5, payload.token)).toBe(false);
  });

  it("rejects a token older than the allowed clock-skew tolerance", () => {
    const payload = generateCurrentQrToken("gym-1");
    // 1 window of tolerance is allowed; going back many windows should fail.
    expect(verifyQrToken("gym-1", payload.bucket - 10, payload.token)).toBe(false);
  });

  it("accepts a token from exactly one window back (clock-skew tolerance)", () => {
    vi.useFakeTimers();
    const start = new Date("2026-01-01T10:00:00.000Z");
    vi.setSystemTime(start);
    const payload = generateCurrentQrToken("gym-1");

    // Advance by exactly one 20s window.
    vi.setSystemTime(new Date(start.getTime() + 20_000));
    expect(verifyQrToken("gym-1", payload.bucket, payload.token)).toBe(true);

    vi.useRealTimers();
  });
});
