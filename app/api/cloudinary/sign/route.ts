import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateUploadSignature, type CloudinaryFolder, type CloudinaryResourceType } from "@/lib/services/cloudinary";

const ALLOWED_FOLDERS: CloudinaryFolder[] = [
  "members/photos",
  "trainers/photos",
  "members/transformations",
  "members/certificates",
  "workouts/images",
  "chat/attachments",
];

const ALLOWED_RESOURCE_TYPES: CloudinaryResourceType[] = ["image", "video", "raw"];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const folder = body?.folder as CloudinaryFolder;
  const publicIdPrefix = (body?.publicIdPrefix as string) ?? user.id;
  const resourceType = (body?.resourceType as CloudinaryResourceType) ?? "image";

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return NextResponse.json({ error: "Invalid upload folder." }, { status: 400 });
  }
  if (!ALLOWED_RESOURCE_TYPES.includes(resourceType)) {
    return NextResponse.json({ error: "Invalid resource type." }, { status: 400 });
  }

  const signed = generateUploadSignature(folder, publicIdPrefix.replace(/[^a-zA-Z0-9-_]/g, "-"), resourceType);
  return NextResponse.json(signed);
}
