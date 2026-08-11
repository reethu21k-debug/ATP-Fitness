/**
 * Cross-platform, mobile-safe file download.
 *
 * Why this exists: `element.click()` on a hidden `<a download>` blob-URL
 * link is what jsPDF's `.save()` and SheetJS's `.writeFile()` do under the
 * hood, and it's unreliable on mobile -- iOS Safari (and most in-app
 * WebViews: Instagram, WhatsApp, Facebook browsers, etc.) either ignores
 * the `download` attribute and opens the blob inline instead of saving it,
 * or silently does nothing.
 *
 * The fix: prefer the Web Share API (`navigator.share` with a `File`),
 * which is what mobile browsers actually support for "save this file" --
 * it opens the native share/save sheet. Desktop browsers (and mobile
 * browsers without file-sharing support) fall back to the classic
 * anchor-click blob download, which works fine there.
 */
export async function downloadBlob(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  const canUseShare =
    typeof nav.share === "function" &&
    typeof nav.canShare === "function" &&
    nav.canShare({ files: [file] });

  if (canUseShare) {
    try {
      await nav.share!({ files: [file], title: filename });
      return;
    } catch (err) {
      // User cancelled the share sheet, or share failed -- fall through to
      // the anchor-download path below rather than leaving them stuck.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // iOS Safari ignores `download` and just navigates/opens the blob inline
  // instead of triggering a save -- opening it in a new tab is the closest
  // reliable behavior there, so the user can use the native share/save icon.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
  if (isIOS) {
    window.open(url, "_blank");
  }

  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}