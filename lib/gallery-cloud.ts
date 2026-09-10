import { useState, useEffect } from "react";
import type { AlbumSpread } from "@/data/album";
import type { UploadedPhoto, CustomSticker } from "./upload-service";
import {
  readUploadedPhotos,
  readCustomStickers,
  replaceUploadedPhotos,
  replaceCustomStickers,
} from "./upload-service";
import {
  readAlbumSpreads,
  saveAlbumSpreads,
  replaceAlbumUploads,
} from "./album-service";

/** Save status shown in the "Saving… / Saved ✓ / Failed to save" chip. */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Whether the cloud is live, and if not, why. */
export type CloudSyncStatus =
  | { on: true }
  | { on: false; reason: "not-configured" | "blob-error" | "unreachable" };

/**
 * One JSON document in Vercel Blob (or any future cloud store reached through
 * /api/gallery) that every device loads. Uploaded image *bytes* live in
 * Cloudinary; this document stores their URLs and all customization data
 * (memories, stickers, album book).
 */
export type CloudSnapshot = {
  memories: UploadedPhoto[];
  customStickers: CustomSticker[];
  albumSpreads: AlbumSpread[];
  savedAt: number;
};

const imageCachePrefix = "lunatey-image-url:";
const savedAtKey = "lunatey-gallery-saved-at";

const saveListeners = new Set<(status: SaveStatus, detail?: string) => void>();
const revisionListeners = new Set<(revision: number) => void>();

export function onSaveStatusChange(
  listener: (status: SaveStatus, detail?: string) => void,
): () => void {
  saveListeners.add(listener);
  return () => saveListeners.delete(listener);
}

function emitSaveStatus(status: SaveStatus, detail?: string): void {
  for (const listener of saveListeners) {
    try {
      listener(status, detail);
    } catch {
      // a broken listener must never break saving
    }
  }
}

/** Subscribe to "a cloud snapshot has been applied" so UI can re-read storage. */
export function onSnapshotApplied(
  listener: (revision: number) => void,
): () => void {
  revisionListeners.add(listener);
  return () => revisionListeners.delete(listener);
}

function setSavedAt(value: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(savedAtKey, String(value));
  } catch {
    // storage blocked — the timestamp simply won't persist
  }
}

/**
 * Cache Cloudinary URLs so a repeated upload isn't sent again.
 * Keyed by the data URL itself (stale caches only delay a tiny retry).
 */
function cacheImageUrl(key: string, url: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(imageCachePrefix + key, url);
  } catch {
    // ignore
  }
}

function readCachedImageUrl(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(imageCachePrefix + key) ?? null;
  } catch {
    return null;
  }
}

/**
 * Upload an image (data URL from the browser) to Cloudinary via /api/upload.
 * Returns the permanent URL — the browser keeps only the URL, never the bytes.
 * Results are cached so a retry never re-sends the same image.
 */
export async function uploadImage(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    throw new Error("uploadImage needs a valid image data URL");
  }

  // bail out fast if we already uploaded this exact payload
  const cached = readCachedImageUrl(dataUrl);
  if (cached) return cached;

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });

    if (!res.ok) {
      throw new Error(`uploadImage: server returned ${res.status}`);
    }

    const json = (await res.json()) as {
      url?: string;
      error?: string;
    };

    if (!json.url) {
      throw new Error(json.error || "uploadImage: no URL returned");
    }

    cacheImageUrl(dataUrl, json.url);
    return json.url;
  } catch (error) {
    // Cloudinary is unreachable: keep the data URL so the photo is not lost.
    // The sync layer re-tries the upload on its next save.
    console.error(
      "Birthday site: cloud upload failed, keeping local copy:",
      error,
    );
    return dataUrl;
  }
}

let snapshotRevision = 0;
let cloudStatus: CloudSyncStatus = { on: false, reason: "not-configured" };

/** The last known cloud status, readable synchronously by the UI. */
export function getCloudStatus(): CloudSyncStatus {
  return cloudStatus;
}

/** How many times the cloud snapshot was applied since this page loaded. */
export function getSnapshotRevision(): number {
  return snapshotRevision;
}

function bumpSnapshotRevision(): void {
  snapshotRevision += 1;
  for (const listener of revisionListeners) {
    try {
      listener(snapshotRevision);
    } catch {
      // ignore a broken listener
    }
  }
}

/**
 * Every image URL placed in the album book, rebuilt as upload records.
 * Kept so a snapshot *replaces* the device's album-upload list exactly —
 * photos removed on another device can never sneak back via a stale record.
 */
function albumUploadsFromSpreads(spreads: AlbumSpread[]): UploadedPhoto[] {
  const seen = new Set<string>();
  const uploads: UploadedPhoto[] = [];
  for (const spread of spreads) {
    for (const photo of spread.left.photos) {
      if (!photo.image || seen.has(photo.image)) continue;
      seen.add(photo.image);
      uploads.push({
        id: photo.id,
        src: photo.image,
        alt: photo.alt,
        title: photo.title,
        date: photo.date,
        caption: photo.caption,
        layout: "square",
        stickerIndex: photo.stickerIndex,
        customStickerSrc: photo.customStickerSrc,
      });
    }
    for (const photo of spread.right.photos) {
      if (!photo.image || seen.has(photo.image)) continue;
      seen.add(photo.image);
      uploads.push({
        id: photo.id,
        src: photo.image,
        alt: photo.alt,
        title: photo.title,
        date: photo.date,
        caption: photo.caption,
        layout: "square",
        stickerIndex: photo.stickerIndex,
        customStickerSrc: photo.customStickerSrc,
      });
    }
  }
  return uploads;
}

/**
 * Write a cloud snapshot into this device's storage. Every write replaces
 * (never duplicates), so repeated loads stay perfectly in sync with the cloud.
 */
export function applySnapshot(snapshot: CloudSnapshot): void {
  if (typeof window === "undefined") return;
  replaceUploadedPhotos(snapshot.memories ?? []);
  replaceCustomStickers(snapshot.customStickers ?? []);
  if (snapshot.albumSpreads) {
    saveAlbumSpreads(snapshot.albumSpreads);
    replaceAlbumUploads(albumUploadsFromSpreads(snapshot.albumSpreads));
  }
  setSavedAt(snapshot.savedAt || 0);
  bumpSnapshotRevision();
}

/**
 * Load the shared gallery from the cloud and apply it to this device.
 * Safe to call repeatedly — each run replaces local data with the newest
 * cloud copy, which is exactly how a second device picks up everything.
 */
export async function loadState(): Promise<CloudSyncStatus> {
  if (typeof window === "undefined") {
    cloudStatus = { on: false, reason: "not-configured" };
    return cloudStatus;
  }

  emitSaveStatus("saving", "loading gallery…");

  try {
    const res = await fetch("/api/gallery", { method: "GET" });

    if (res.status === 503 || res.status === 501) {
      // The API explicitly reported "cloud not configured".
      cloudStatus = { on: false, reason: "not-configured" };
      emitSaveStatus("saved", "saved on this device");
      return cloudStatus;
    }

    if (!res.ok) {
      cloudStatus = { on: false, reason: "blob-error" };
      emitSaveStatus("error", "could not load the cloud copy");
      return cloudStatus;
    }

    const payload = (await res.json()) as {
      cloud?: boolean;
      state?: CloudSnapshot | null;
      savedAt?: number;
    };

    if (payload.state) {
      applySnapshot(payload.state);
      setSavedAt(payload.state.savedAt || Date.now());
      cloudStatus = { on: true };
      emitSaveStatus("saved", "gallery loaded from cloud");
    } else {
      // No cloud copy yet — everything stays exactly as it is on this device.
      cloudStatus = { on: true };
      emitSaveStatus("saved", "gallery loaded");
    }
    return cloudStatus;
  } catch {
    cloudStatus = { on: false, reason: "unreachable" };
    emitSaveStatus("error", "could not reach the gallery");
    return cloudStatus;
  }
}

/**
 * Persist the shared cloud state. Local storage is written first (so nothing
 * is ever lost offline or on failure), then the cloud copy is replaced.
 * Returns whether the cloud accepted the save.
 */
export async function saveState(options?: {
  memories?: UploadedPhoto[];
  customStickers?: CustomSticker[];
  albumSpreads?: AlbumSpread[];
  savedAt?: number;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const now = options?.savedAt ?? Date.now();
  const memories = options?.memories ?? readUploadedPhotos();
  const customStickers = options?.customStickers ?? readCustomStickers();
  const albumSpreads = options?.albumSpreads ?? (readAlbumSpreads() ?? []);

  // persist locally first — a failed cloud save must never lose data
  replaceUploadedPhotos(memories);
  replaceCustomStickers(customStickers);
  saveAlbumSpreads(albumSpreads);
  replaceAlbumUploads(albumUploadsFromSpreads(albumSpreads));
  setSavedAt(now);

  emitSaveStatus("saving", "saving…");
  try {
    const res = await fetch("/api/gallery", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memories,
        customStickers,
        albumSpreads,
        savedAt: now,
      }),
    });

    if (res.status === 503 || res.status === 501) {
      // Cloud store not configured — the data is already safe on this device.
      cloudStatus = { on: false, reason: "not-configured" };
      emitSaveStatus("saved", "saved on this device");
      return false;
    }

    if (!res.ok) {
      throw new Error(`saveState: server returned ${res.status}`);
    }

    const json = (await res.json()) as { savedAt?: number };
    setSavedAt(Number(json.savedAt) || now);
    cloudStatus = { on: true };
    emitSaveStatus("saved", "saved ✓");
    return true;
  } catch {
    cloudStatus = { on: false, reason: "unreachable" };
    emitSaveStatus("error", "failed to save");
    return false;
  }
}

/**
 * React hook that loads the cloud state on mount and exposes the live save
 * indicator ("Saving… / Saved ✓ / Failed to save"), the cloud status, and a
 * revision counter that bumps whenever a cloud snapshot has been applied —
 * components re-read storage on revision change to show cross-device data.
 */
export function useSaveStatus(): {
  status: SaveStatus;
  message: string;
  cloud: CloudSyncStatus;
  revision: number;
} {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [cloud, setCloud] = useState<CloudSyncStatus>(getCloudStatus());
  const [revision, setRevision] = useState(getSnapshotRevision());

  useEffect(() => {
    const off = onSaveStatusChange((s, detail) => {
      setStatus(s);
      setMessage(detail ?? "");
    });
    return off;
  }, []);

  useEffect(() => {
    const off = onSnapshotApplied((next) => {
      setRevision(next);
      setCloud(getCloudStatus());
    });
    return off;
  }, []);

  // fire-and-forget: the page renders first, the cloud arrives when ready
  useEffect(() => {
    let cancelled = false;
    void loadState()
      .then((result) => {
        if (!cancelled) setCloud(result);
      })
      .catch(() => {
        if (!cancelled) setCloud({ on: false, reason: "unreachable" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, message, cloud, revision };
}