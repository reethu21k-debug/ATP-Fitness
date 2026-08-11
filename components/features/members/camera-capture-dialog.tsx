"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
}

/**
 * Opens the device camera in a live preview (via getUserMedia) inside a
 * dialog, lets the user snap a photo, review it, retake if needed, and
 * confirm — at which point the captured frame is handed back as a File
 * ready to feed into the existing upload pipeline.
 *
 * Falls back gracefully with an error message if the browser/device has no
 * camera or the user denies permission (e.g. desktop browsers without a
 * webcam, or camera access blocked).
 */
export function CameraCaptureDialog({ open, onOpenChange, onCapture }: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  // Start the camera whenever the dialog opens; always stop it on close/unmount
  // so the browser's camera indicator light turns off and the device is freed.
  useEffect(() => {
    if (!open) {
      stopStream();
      setCapturedUrl(null);
      setCapturedBlob(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setStarting(true);
    setError(null);

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't access the camera. Check your browser's camera permission, or use \"Choose from device\" instead.");
        }
      })
      .finally(() => {
        if (!cancelled) setStarting(false);
      });

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setCapturedUrl(URL.createObjectURL(blob));
        stopStream(); // freeze the frame, release the camera while reviewing
      },
      "image/jpeg",
      0.92
    );
  }

  function handleRetake() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedBlob(null);
    // Restart the camera for another shot.
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError("Couldn't restart the camera. Try closing and reopening this dialog."));
  }

  function handleUsePhoto() {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Take a photo</DialogTitle>
          <DialogDescription>
            {capturedUrl ? "Review your photo below." : "Line up the shot, then tap Capture."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-black">
          {error ? (
            <p className="p-6 text-center text-sm text-destructive">{error}</p>
          ) : capturedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={capturedUrl} alt="Captured preview" className="h-full w-full object-cover" />
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Hidden canvas used only to grab a still frame from the video stream. */}
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex justify-end gap-2">
          {error ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : capturedUrl ? (
            <>
              <Button variant="outline" onClick={handleRetake}>
                <RotateCcw className="h-4 w-4" />
                Retake
              </Button>
              <Button onClick={handleUsePhoto}>
                <Check className="h-4 w-4" />
                Use photo
              </Button>
            </>
          ) : (
            <Button onClick={handleCapture} disabled={starting}>
              <Camera className="h-4 w-4" />
              Capture
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}