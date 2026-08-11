"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImageUp, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { CloudinaryFolder } from "@/lib/services/cloudinary";
import { CameraCaptureDialog } from "./camera-capture-dialog";

interface PhotoUploadProps {
  folder: CloudinaryFolder;
  publicIdPrefix: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  shape?: "circle" | "square";
}

export function PhotoUpload({ folder, publicIdPrefix, value, onChange, shape = "circle" }: PhotoUploadProps) {
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be under 8MB.");
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const signRes = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, publicIdPrefix }),
      });
      if (!signRes.ok) throw new Error("Could not authorize upload.");
      const signed = await signRes.json();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signed.apiKey);
      formData.append("timestamp", String(signed.timestamp));
      formData.append("signature", signed.signature);
      formData.append("folder", signed.folder);
      formData.append("public_id", signed.publicId);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed.");
      const uploaded = await uploadRes.json();

      onChange(uploaded.secure_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed border-input bg-muted",
          shape === "circle" ? "rounded-full" : "rounded-xl"
        )}
      >
        {value ? (
          <Image src={value} alt="Uploaded photo" fill sizes="80px" className="object-cover" />
        ) : (
          <Camera className="h-6 w-6 text-muted-foreground" />
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {value && !uploading && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
            aria-label="Remove photo"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div>
        {/* Device input: opens the normal file/photo library picker. */}
        <input
          ref={deviceInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            e.target.files?.[0] && handleFile(e.target.files[0]);
            e.target.value = ""; // allow re-selecting the same file next time
          }}
        />

        <p className="mb-1.5 text-sm font-medium text-foreground">{value ? "Change photo" : "Upload photo"}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
            Take photo
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            type="button"
            onClick={() => deviceInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            <ImageUp className="h-3.5 w-3.5" />
            Choose from device
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">JPG or PNG, up to 8MB</p>
        {error && <p className="mt-0.5 text-xs text-destructive">{error}</p>}
      </div>

      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => handleFile(file)}
      />
    </div>
  );
}