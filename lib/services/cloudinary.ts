import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type CloudinaryFolder =
  | "members/photos"
  | "trainers/photos"
  | "members/transformations"
  | "members/certificates"
  | "workouts/images"
  | "chat/attachments"
  | "invoices";

/** Cloudinary's own upload-endpoint bucket — images and voice notes (audio is
 * uploaded under Cloudinary's "video" resource type) get transformed/streamed;
 * PDFs are uploaded as "raw" so they're served byte-for-byte. */
export type CloudinaryResourceType = "image" | "video" | "raw";

/**
 * Generates a signature for a direct-to-Cloudinary signed upload.
 * The browser uploads the file straight to Cloudinary using this signature —
 * the file itself never passes through our server, only the small signed
 * request parameters do.
 */
export function generateUploadSignature(
  folder: CloudinaryFolder,
  publicIdPrefix: string,
  resourceType: CloudinaryResourceType = "image"
) {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, folder, public_id: `${publicIdPrefix}-${timestamp}` };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    folder,
    publicId: paramsToSign.public_id,
    resourceType,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  };
}

export async function deleteCloudinaryAsset(publicId: string) {
  return cloudinary.uploader.destroy(publicId);
}

/**
 * Uploads a file we generated on the server (e.g. an invoice PDF) straight
 * to Cloudinary — unlike generateUploadSignature above, there's no browser
 * round-trip here since the bytes never existed client-side.
 *
 * PDFs are uploaded as "raw" so Cloudinary serves them byte-for-byte instead
 * of trying to transform them as an image.
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: CloudinaryFolder,
  publicId: string,
  options: { resourceType?: CloudinaryResourceType; format?: string; mimeType?: string } = {}
) {
  const { resourceType = "raw", format = "pdf", mimeType = "application/pdf" } = options;
  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    public_id: publicId,
    resource_type: resourceType,
    format,
    overwrite: true,
    access_mode: "public",
  });

  // NOTE: result.secure_url is a direct public Cloudinary CDN delivery link.
  // For "raw" (PDF) uploads specifically, DON'T hand this straight to users
  // -- many Cloudinary accounts block public delivery of raw PDF/ZIP files,
  // and workarounds (signed URLs, forcing type=authenticated) have proven
  // unreliable in testing. Callers that need a user-facing download link for
  // a raw upload should instead route through /api/invoices/download using
  // the publicId below, which fetches the file server-side via Cloudinary's
  // authenticated Admin API -- a path that isn't subject to that restriction.
  return { url: result.secure_url as string, publicId: result.public_id as string };
}