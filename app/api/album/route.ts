import { NextResponse } from "next/server";
import { list, put } from "@vercel/blob";
import type { AlbumSpread } from "@/data/album";

export const runtime = "nodejs";

const STATE_PATH = "albums/album-state.json";

/**
 * The whole album book (pages + photos) as one JSON document in the cloud.
 * GET returns what every device should see; PUT replaces it after a save.
 * Requires the BLOB_READ_WRITE_TOKEN environment variable in Vercel.
 */
export async function GET(): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ cloud: false });
  }
  try {
    const listed = await list({ prefix: STATE_PATH });
    const blob = listed.blobs.find((item) => item.pathname === STATE_PATH);
    if (!blob) {
      // Cloud is on, but nobody has saved the album yet.
      return NextResponse.json({ cloud: true, spreads: null, savedAt: 0 });
    }
    const response = await fetch(blob.url, { cache: "no-store" });
    const data = (await response.json()) as {
      spreads?: AlbumSpread[];
      savedAt?: number;
    };
    return NextResponse.json({
      cloud: true,
      spreads: Array.isArray(data.spreads) ? data.spreads : null,
      savedAt: Number(data.savedAt) || 0,
    });
  } catch {
    return NextResponse.json({ cloud: false });
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Blob storage is not configured" },
      { status: 503 },
    );
  }
  try {
    const body = (await request.json()) as {
      spreads?: AlbumSpread[];
      savedAt?: number;
    };
    if (!Array.isArray(body.spreads)) {
      return NextResponse.json(
        { error: "Invalid album payload" },
        { status: 400 },
      );
    }
    await put(STATE_PATH, JSON.stringify({
      spreads: body.spreads,
      savedAt: Number(body.savedAt) || Date.now(),
    }), {
      access: "public",
      contentType: "application/json",
      // Same pathname every save — the blob is replaced, not duplicated.
      addRandomSuffix: false,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not save the album" },
      { status: 500 },
    );
  }
}
