"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { RefreshCw } from "lucide-react";

interface QrPayload {
  gymId: string;
  bucket: number;
  token: string;
  expiresAt: number;
}

const WINDOW_MS = 20_000;

export function AttendanceKiosk({ gymName }: { gymName: string }) {
  const [payload, setPayload] = useState<QrPayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [error, setError] = useState<string | null>(null);

  async function fetchToken() {
    try {
      const res = await fetch("/api/attendance/qr-token", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load QR code.");
      setPayload(await res.json());
      setError(null);
    } catch {
      setError("Could not refresh the QR code. Retrying…");
    }
  }

  useEffect(() => {
    fetchToken();
    const refreshInterval = setInterval(fetchToken, WINDOW_MS);
    return () => clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    if (!payload) return;
    const tick = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((payload.expiresAt - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(tick);
  }, [payload]);

  const qrValue = payload ? JSON.stringify({ gymId: payload.gymId, bucket: payload.bucket, token: payload.token }) : "";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 rounded-2xl border bg-card p-10 text-center">
      <div>
        <h2 className="text-2xl font-semibold">{gymName} — Check In</h2>
        <p className="mt-1 text-sm text-muted-foreground">Scan this code from the ATP Fitness member app to check in.</p>
      </div>

      <div className="rounded-2xl border-4 border-primary/20 bg-white p-6">
        {payload ? <QRCode value={qrValue} size={260} /> : <div className="flex h-[260px] w-[260px] items-center justify-center text-muted-foreground">Loading…</div>}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5" />
        Refreshes in {secondsLeft}s
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
