import type { AlbumPhoto, AlbumSpread } from "@/data/album";
import { readAlbumSpreads, saveAlbumSpreads } from "./album-service";

/**
 * Cross-device album sync.
 *
 * The album book (pages + photos) is mirrored to the cloud as one JSON
 * document (/api/album, backed by Vercel Blob). Photographs added by the
 * celebrant are uploaded once to the cloud (/api/upload) and their data URLs
 * replaced by permanent cloud URLs, so any device that opens the site —
 * laptop, phone, tablet — sees the exact same book.
 *
 * Everything degrades gracefully: if the cloud is not configured
 * (no BLOB_READ_WRITE_TOKEN) or the network fails, the album keeps working
 * exactly as before from localStorage.
 */

const savedAtKey = "birthday-album-saved-at";
const imageCacheKey = "birthday-album-image-urls";

type CloudState = {
  cloud: boolean;
  reason?: string;
  spreads: AlbumSpread[] | null;
  savedAt: number;
};

export type CloudSyncStatus =
  | { on: true }
  | { on: false; reason: "not-configured" | "blob-error" | "unreachable" };

async function fetchCloudState(): Promise<CloudState | null> {
  try {
    const response = await fetch("/api/album", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as CloudState;
  } catch {
    return null;
  }
}

function readLocalSavedAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(savedAtKey)) || 0;
  } catch {
    return 0;
  }
}

function writeLocalSavedAt(savedAt: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(savedAtKey, String(savedAt));
  } catch {
    // ignore — private mode or blocked storage
  }
}

/**
 * Stamp every local album save, even when the cloud push fails or is not
 * configured yet. This keeps the "which copy is newer" comparison honest:
 * without it, a device that saved offline could later be "overwritten" by an
 * older cloud copy the moment the token is added.
 */
export function noteLocalAlbumSave(): void {
  writeLocalSavedAt(Date.now());
}

/** Same shape check as album-service's sanitizer (kept here to avoid cycles). */
function isSpreadList(value: unknown): value is AlbumSpread[] {
  return (
    Array.isArray(value) &&
    value.every(
      (spread) =>
        !!spread &&
        typeof spread === "object" &&
        !!(spread as AlbumSpread).left &&
        !!(spread as AlbumSpread).right &&
        Array.isArray((spread as AlbumSpread).left.photos) &&
        Array.isArray((spread as AlbumSpread).right.photos),
    )
  );
}

/** Total photographs across every page of a book. */
function countPhotos(spreads: AlbumSpread[]): number {
  return spreads.reduce(
    (total, spread) =>
      total + spread.left.photos.length + spread.right.photos.length,
    0,
  );
}

/**
 * Fetch the shared cloud book and adopt it when it is newer than this
 * device's copy. Returns the adopted spreads, or null when the cloud is
 * unavailable / unconfigured / not newer (then local stays the truth).
 */
export async function pullCloudAlbum(): Promise<AlbumSpread[] | null> {
  const state = await fetchCloudState();
  if (!state || !state.cloud || !isSpreadList(state.spreads)) return null;
  if (state.spreads.length === 0) return null;
  const localAt = readLocalSavedAt();
  // Adopt when the cloud is strictly newer — or when it simply holds more
  // photographs than this device (a device whose clock is off must never
  // hide photos that were added somewhere else; last-writer still wins the
  // moment this device saves).
  const local = readAlbumSpreads();
  const newer = state.savedAt > localAt;
  const richer = countPhotos(state.spreads) > countPhotos(local ?? []);
  if (!newer && !richer) return null;
  saveAlbumSpreads(state.spreads);
  writeLocalSavedAt(state.savedAt);
  return state.spreads;
}

/**
 * Is the shared cloud album actually reachable from this deployment?
 * The celebrant UI uses this so a silently-off sync is never invisible:
 * "not-configured" = the Vercel Blob token is not attached to the deployment;
 * "blob-error" = token exists but the store could not be read;
 * "unreachable" = the network request itself failed.
 */
export async function checkCloudSync(): Promise<CloudSyncStatus> {
  const state = await fetchCloudState();
  if (!state) return { on: false, reason: "unreachable" };
  if (!state.cloud) {
    return {
      on: false,
      reason: state.reason === "blob-error" ? "blob-error" : "not-configured",
    };
  }
  return { on: true };
}

/** Cheap stable key for the data-URL → cloud-URL cache. */
function hashKey(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return `${hash}-${text.length}`;
}

function readImageCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(imageCacheKey);
    const parsed = saved ? (JSON.parse(saved) as unknown) : {};
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function writeImageCache(cache: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(imageCacheKey, JSON.stringify(cache));
  } catch {
    // ignore — cache is an optimization only
  }
}

async function uploadDataUrl(dataUrl: string): Promise<string | null> {
  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { url?: string };
    return typeof data.url === "string" ? data.url : null;
  } catch {
    return null;
  }
}

/** Replace one photo's data URLs (photo + sticker) with cloud URLs. */
async function cloudifyPhoto(
  photo: AlbumPhoto,
  cache: Record<string, string>,
): Promise<AlbumPhoto> {
  let image = photo.image;
  if (image.startsWith("data:")) {
    const key = hashKey(image);
    let url: string | undefined = cache[key];
    if (!url) {
      url = (await uploadDataUrl(image)) ?? undefined;
      if (url) cache[key] = url;
    }
    if (url) image = url;
  }
  let customStickerSrc = photo.customStickerSrc;
  if (customStickerSrc && customStickerSrc.startsWith("data:")) {
    const key = hashKey(customStickerSrc);
    let url: string | undefined = cache[key];
    if (!url) {
      url = (await uploadDataUrl(customStickerSrc)) ?? undefined;
      if (url) cache[key] = url;
    }
    if (url) customStickerSrc = url;
  }
  return image === photo.image && customStickerSrc === photo.customStickerSrc
    ? photo
    : { ...photo, image, customStickerSrc };
}

/**
 * Push the whole book to the cloud so every other device sees it:
 * 1. any photo still stored as a data URL is uploaded once and swapped to
 *    its permanent cloud URL (cached so re-saves never re-upload), then
 * 2. the resulting book is written as one JSON document.
 * Silently does nothing when the cloud is unavailable — localStorage keeps
 * working exactly as before.
 */
export async function pushCloudAlbum(spreads: AlbumSpread[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const cache = readImageCache();
    const cloudified: AlbumSpread[] = [];
    for (const spread of spreads) {
      cloudified.push({
        ...spread,
        left: {
          ...spread.left,
          photos: await Promise.all(
            spread.left.photos.map((photo) => cloudifyPhoto(photo, cache)),
          ),
        },
        right: {
          ...spread.right,
          photos: await Promise.all(
            spread.right.photos.map((photo) => cloudifyPhoto(photo, cache)),
          ),
        },
      });
    }
    writeImageCache(cache);
    const savedAt = Date.now();
    const response = await fetch("/api/album", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spreads: cloudified, savedAt }),
    });
    if (!response.ok) return;
    writeLocalSavedAt(savedAt);
  } catch {
    // cloud sync is best-effort; the local save already succeeded
  }
}