import crypto from "crypto";

const WINDOW_MS = 20_000; // 20-second rotation
const CLOCK_SKEW_WINDOWS = 1; // accept the current window and 1 window back

function bucketFor(timestampMs: number) {
  return Math.floor(timestampMs / WINDOW_MS);
}

function sign(gymId: string, bucket: number) {
  const secret = process.env.QR_SECRET;
  if (!secret) throw new Error("QR_SECRET is not configured.");
  return crypto.createHmac("sha256", secret).update(`${gymId}:${bucket}`).digest("hex").slice(0, 24);
}

export interface QrTokenPayload {
  gymId: string;
  bucket: number;
  token: string;
  expiresAt: number; // epoch ms when this exact token stops being the "current" one
}

/** Generates the QR payload for right now. Call again every 20s to rotate it. */
export function generateCurrentQrToken(gymId: string): QrTokenPayload {
  const now = Date.now();
  const bucket = bucketFor(now);
  return {
    gymId,
    bucket,
    token: sign(gymId, bucket),
    expiresAt: (bucket + 1) * WINDOW_MS,
  };
}

/**
 * Verifies a scanned token. Accepts the current window and a small number of
 * windows back to tolerate the short delay between a phone scanning the
 * screen and the check-in request reaching the server.
 */
export function verifyQrToken(gymId: string, bucket: number, token: string): boolean {
  const currentBucket = bucketFor(Date.now());
  if (bucket > currentBucket || currentBucket - bucket > CLOCK_SKEW_WINDOWS) return false;
  const expected = sign(gymId, bucket);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
