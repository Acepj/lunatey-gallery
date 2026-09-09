import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Uploads one album photo (as a data URL from the browser) to Vercel Blob so
 * every device that opens the site sees the same photograph.
 * Requires the BLOB_READ_WRITE_TOKEN environment variable in Vercel.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Blob storage is not configured" },
      { status: 503 },
    );
  }
  try {
    const body: unknown = await request.json();
    const dataUrl =
      typeof body === "object" && body !== null && "dataUrl" in body
        ? String((body as { dataUrl: unknown }).dataUrl)
        : "";
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid image payload" },
        { status: 400 },
      );
    }
    const [, mime, base64] = match;
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image is too large" },
        { status: 413 },
      );
    }
    const extension = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const pathname = `albums/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: mime,
    });
    return NextResponse.json({ url: blob.url });
  } catch {
    return NextResponse.json(
      { error: "Could not upload the photo" },
      { status: 500 },
    );
  }
}
