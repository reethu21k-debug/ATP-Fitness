"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { checkInMember } from "@/lib/actions/attendance.actions";
import { ScanLine, CheckCircle2, Loader2 } from "lucide-react";

const SCANNER_ELEMENT_ID = "atp-fitness-qr-scanner";

export function QrScannerDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const [status, setStatus] = useState<"scanning" | "processing" | "success" | "error">("scanning");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus("scanning");
    setMessage(null);

    let cancelled = false;
    let rafId: number | null = null;

    const safeStop = async (scanner: Html5Qrcode) => {
      // html5-qrcode throws if you call stop() when it isn't actually
      // running/paused — guard with our own tracked flag rather than
      // trusting the caller to know the internal state.
      if (!isRunningRef.current) return;
      isRunningRef.current = false;
      await scanner.stop().catch(() => {});
    };

    const tryStart = () => {
      if (cancelled) return;

      const el = document.getElementById(SCANNER_ELEMENT_ID);
      if (!el) {
        rafId = requestAnimationFrame(tryStart);
        return;
      }

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          async (decodedText) => {
            if (cancelled) return;
            setStatus((prev) => (prev === "processing" || prev === "success" ? prev : "processing"));

            await safeStop(scanner);
            if (cancelled) return;

            try {
              const parsed = JSON.parse(decodedText);
              const gps = await getGpsCoords();
              const result = await checkInMember({
                gymId: parsed.gymId,
                bucket: parsed.bucket,
                token: parsed.token,
                gps,
              });
              if (cancelled) return;

              if (!result.success) {
                setStatus("error");
                setMessage(result.error);
              } else {
                setStatus("success");
                setMessage(result.data?.gpsVerified ? "Checked in — location verified." : "Checked in!");
                setTimeout(() => {
                  onSuccess();
                  onOpenChange(false);
                }, 1200);
              }
            } catch {
              if (!cancelled) {
                setStatus("error");
                setMessage("That doesn't look like a valid ATP Fitness check-in code.");
              }
            }
          },
          () => {} // ignore per-frame scan failures
        )
        .then(() => {
          if (cancelled) {
            // Effect was cleaned up while start() was still resolving —
            // stop immediately instead of leaving the camera running.
            safeStop(scanner);
          } else {
            isRunningRef.current = true;
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatus("error");
            setMessage("Could not access the camera. Check your browser permissions.");
          }
        });
    };

    rafId = requestAnimationFrame(tryStart);

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) safeStop(scanner);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan to check in</DialogTitle>
          <DialogDescription>Point your camera at the QR code on the front-desk screen.</DialogDescription>
        </DialogHeader>

        <div id={SCANNER_ELEMENT_ID} className="mx-auto w-full max-w-xs overflow-hidden rounded-xl" />

        {status === "processing" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
          </div>
        )}
        {status === "success" && (
          <div className="flex items-center justify-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> {message}
          </div>
        )}
        {status === "error" && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-destructive">{message}</p>
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}
        {status === "scanning" && (
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ScanLine className="h-3.5 w-3.5" /> Looking for a QR code…
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function getGpsCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 4000 }
    );
  });
}