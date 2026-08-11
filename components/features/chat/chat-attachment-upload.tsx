"use client";

import { useRef, useState } from "react";
import { Paperclip, Loader2, Image as ImageIcon, Mic, FileText } from "lucide-react";

export interface ChatAttachment {
  url: string;
  type: "image" | "voice" | "pdf";
  publicId: string;
}

function classifyFile(file: File): { type: ChatAttachment["type"]; resourceType: "image" | "video" | "raw" } | null {
  if (file.type.startsWith("image/")) return { type: "image", resourceType: "image" };
  if (file.type.startsWith("audio/")) return { type: "voice", resourceType: "video" }; // Cloudinary streams audio under "video"
  if (file.type === "application/pdf") return { type: "pdf", resourceType: "raw" };
  return null;
}

export function ChatAttachmentUpload({
  onUploaded,
  disabled,
}: {
  onUploaded: (attachment: ChatAttachment) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const kind = classifyFile(file);
    if (!kind) {
      setError("Only images, voice notes, and PDFs are supported.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File must be under 20MB.");
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const signRes = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder: "chat/attachments",
          publicIdPrefix: "chat",
          resourceType: kind.resourceType,
        }),
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

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/${kind.resourceType}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed.");
      const uploaded = await uploadRes.json();

      onUploaded({ url: uploaded.secure_url, type: kind.type, publicId: uploaded.public_id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,audio/*,application/pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        title="Attach an image, voice note, or PDF"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
      </button>
      {error && (
        <p className="absolute bottom-full left-0 mb-1 w-48 rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground">
          {error}
        </p>
      )}
    </div>
  );
}

export function AttachmentPreview({ type, url }: { type: ChatAttachment["type"]; url: string }) {
  if (type === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="Attachment" className="max-h-56 max-w-xs rounded-lg object-cover" />;
  }
  if (type === "voice") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-background/60 p-2">
        <Mic className="h-4 w-4 text-muted-foreground" />
        <audio src={url} controls className="h-8 max-w-[220px]" />
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2 text-sm underline"
    >
      <FileText className="h-4 w-4 shrink-0" /> View PDF
    </a>
  );
}

export const AttachmentTypeIcon = { image: ImageIcon, voice: Mic, pdf: FileText };
