import { NextRequest, NextResponse } from "next/server";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/webp",
];

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
  }

  const maxSize = 2 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ error: "Bestand is te groot (max 2MB)." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Ongeldig bestandstype." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;

  return NextResponse.json({
    url: dataUrl,
    name: file.name,
    size: file.size,
    type: file.type,
  });
}
