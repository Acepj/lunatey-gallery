import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Uploads one image (data URL from the browser) to Cloudinary using the
 * unsigned preset configured in the environment, and returns its permanent
 * URL. This is what makes uploaded photos load on any device — the browser
 * keeps only the URL, never the image bytes.
 *
 * Requires these env vars (already configured in this project):
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
 */
export async function POST(request: Request): Promise<NextResponse> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !preset) {
    return NextResponse.json(
      { error: "Cloudinary is not configured" },
      { status: 503 },
    );
  }
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be JSON" },
        { status: 400 },
      );
    }
    const dataUrl =
      typeof body === "object" && body !== null && "dataUrl" in body
        ? String((body as { dataUrl: unknown }).dataUrl)
        : "";
    // 18 MB cap — comfortably larger than a phone photo, small enough that a
    // broken/bogus request can never hang the upload worker.
    if (dataUrl.length > 18 * 1024 * 1024) {
      return NextResponse.json(
        { error: "The image is too large to upload" },
        { status: 413 },
      );
    }
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid image payload" },
        { status: 400 },
      );
    }
    const folder =
      typeof body === "object" && body !== null && "folder" in body
        ? String((body as { folder: unknown }).folder) || "gallery"
        : "gallery";
    const form = new FormData();
    form.append("file", dataUrl);
    form.append("upload_preset", preset);
    form.append("folder", `lunatey/${folder}`);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: form },
    );
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            response.status === 401 || response.status === 403
              ? "The upload preset is invalid or the image format is not allowed"
              : "The image could not be uploaded",
        },
        { status: 502 },
      );
    }
    const data = (await response.json()) as { secure_url?: string };
    if (!data.secure_url) {
      return NextResponse.json(
        { error: "The image could not be uploaded" },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { url: data.secure_url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "The image could not be uploaded" },
      { status: 500 },
    );
  }
}
