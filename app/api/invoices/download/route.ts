import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function expectedToken(publicId: string) {
  return crypto
    .createHmac("sha256", process.env.INVOICE_DOWNLOAD_SECRET!)
    .update(publicId)
    .digest("hex");
}

/**
 * GET /api/invoices/download?id=<cloudinary public_id>&token=<hmac>
 *
 * Why this exists: linking directly to a Cloudinary "raw" (PDF) delivery
 * URL from an email is unreliable -- many Cloudinary accounts block public
 * delivery of raw PDF/ZIP files by default (a 2018 anti-abuse security
 * setting), and even signed workarounds around that block have proven
 * flaky in testing (double-extension bugs, "Failed to load PDF document"
 * errors on the resulting authenticated URL).
 *
 * This route sidesteps all of that: it fetches the file server-side using
 * Cloudinary's authenticated Admin "download" endpoint (api.cloudinary.com,
 * signed with your api_secret) -- a completely different, always-available
 * code path from the public CDN delivery URL -- then streams the bytes
 * straight back to the browser as a normal same-origin download. This
 * works the same on desktop and mobile since it's just a regular HTTPS GET
 * to your own domain.
 */
export async function GET(req: NextRequest) {
  const publicId = req.nextUrl.searchParams.get("id");
  const token = req.nextUrl.searchParams.get("token");

  if (!publicId || !token) {
    return NextResponse.json({ error: "Missing id or token" }, { status: 400 });
  }

  const expected = expectedToken(publicId);
  const valid =
    expected.length === token.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));

  if (!valid) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
  }

  // publicId already includes the .pdf extension -- Cloudinary bakes the
  // extension into the public_id itself for resource_type "raw".
  const downloadUrl = cloudinary.utils.private_download_url(publicId, "", {
    resource_type: "raw",
    type: "upload",
  });

  const cloudinaryRes = await fetch(downloadUrl);
  if (!cloudinaryRes.ok || !cloudinaryRes.body) {
    return NextResponse.json({ error: "Could not retrieve invoice" }, { status: 502 });
  }

  const filename = publicId.split("/").pop() || "invoice.pdf";

  return new NextResponse(cloudinaryRes.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}