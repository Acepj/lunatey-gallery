import { NextRequest, NextResponse } from "next/server";
import { list, put } from "@vercel/blob";

export const runtime = "nodejs";

const STATE_PATH = "lunatey/gallery-state.json";

/**
 * Vercel Blob needs a read/write access token (`BLOB_READ_WRITE_TOKEN`).
 * When it is missing (fresh clone, `npm run dev` before setup) the API
 * reports "not configured" instead of crashing — the site still works fully,
 * saving on the device, and the save indicator explains that cloud sync is
 * off until the token is added.
 */
function cloudConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_READ_WRITE_TOKEN_SECRET,
  );
}

export async function GET(): Promise<NextResponse> {
  if (!cloudConfigured()) {
    return NextResponse.json(
      { cloud: false, reason: "not-configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const res = await list({ prefix: STATE_PATH });
    const files = res.blobs ?? [];
    if (files.length === 0) {
      return NextResponse.json(
        {
          cloud: true,
          state: null,
          savedAt: 0,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const blob = files[0];
    // The blob is stored with public access — read it straight from its URL
    // (this SDK version exposes url/downloadUrl rather than a download() tool).
    const response = await fetch(blob.url);
    if (!response.ok) {
      throw new Error(`blob download returned ${response.status}`);
    }
    const body = await response.text();
    const state = JSON.parse(body) as {
      memories?: unknown[];
      customStickers?: unknown[];
      albumSpreads?: unknown[];
      savedAt?: number;
    };
    return NextResponse.json(
      {
        cloud: true,
        state: {
          memories: Array.isArray(state.memories) ? state.memories : [],
          customStickers:
            Array.isArray(state.customStickers)
              ? state.customStickers
              : [],
          albumSpreads:
            Array.isArray(state.albumSpreads)
              ? state.albumSpreads
              : [],
          savedAt: Number(state.savedAt) || 0,
        },
        savedAt: Number(state.savedAt) || 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Gallery GET error:", error);
    return NextResponse.json(
      {
        cloud: false,
        reason: "blob-error",
        error: String(error),
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!cloudConfigured()) {
    return NextResponse.json(
      { cloud: false, reason: "not-configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const body = await request.json();
    const state = {
      memories:
        Array.isArray(body.memories) ? body.memories : [],
      customStickers:
        Array.isArray(body.customStickers) ? body.customStickers : [],
      albumSpreads:
        Array.isArray(body.albumSpreads) ? body.albumSpreads : [],
      savedAt: Number(body.savedAt) || Date.now(),
    };
    await put(STATE_PATH, JSON.stringify(state), {
      access: "public",
      addRandomSuffix: false,
    });
    return NextResponse.json(
      { savedAt: state.savedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Gallery PUT error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

