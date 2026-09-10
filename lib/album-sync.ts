import type { AlbumSpread } from "@/data/album";
import type { UploadedPhoto, CustomSticker } from "./upload-service";
import {
  readUploadedPhotos,
  readCustomStickers,
  replaceUploadedPhotos,
  replaceCustomStickers,
} from "./upload-service";
import { readAlbumSpreads, saveAlbumSpreads } from "./album-service";
import {
  type CloudSyncStatus,
  type SaveStatus,
  saveState,
  loadState,
  uploadImage,
  useSaveStatus,
} from "./gallery-cloud";

export type { CloudSyncStatus, SaveStatus } from "./gallery-cloud";

/**
 * Reset *local* caches only — the cloud keeps everything. The page reloads
 * with the newest cloud snapshot applied, including what other devices added.
 */
export function resetOnlyLocalCaches(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("birthday-gallery-uploads");
    window.localStorage.removeItem("birthday-custom-stickers");
    window.localStorage.removeItem("birthday-album-spreads-v2");
    window.localStorage.removeItem("birthday-album-uploads-v2");
  } catch {
    // storage blocked — graceful no-op
  }
  void loadState().finally(() => {
    window.location.reload();
  });
}

/** Ask the server whether the cloud store is live (and pull it if it is). */
export async function checkCloudSync(): Promise<CloudSyncStatus> {
  return loadState();
}

/**
 * Pull the shared album from the cloud into this device. `loadState` already
 * writes the newest cloud snapshot (memories, stickers and album book) into
 * local storage; here we finish by reporting whether a cloud copy of the
 * album exists so the album component can re-read it.
 */
export async function pullCloudAlbum(): Promise<boolean> {
  const status = await loadState();
  if (!status.on) return false;
  const spreads = readAlbumSpreads();
  return Array.isArray(spreads) && spreads.length > 0;
}

/**
 * Called right after the album saved its spreads locally and before the cloud
 * push. `saveState` (invoked by `pushCloudAlbum`) drives the whole
 * Saving… → Saved ✓ / Failed indicator, so no extra work is needed here.
 */
export function noteLocalAlbumSave(): void {
  // Intentionally a no-op: the cloud push that follows owns the indicator.
}

/**
 * Save the album (spreads) plus the current memories/stickers to the cloud.
 * Local storage is written first, so an offline or failed save never loses
 * the book; leftover raw image bytes are pushed to Cloudinary first so they
 * become permanent URLs every device can load.
 */
export async function pushCloudAlbum(next: AlbumSpread[]): Promise<void> {
  if (typeof window === "undefined") return;
  saveAlbumSpreads(next);
  const memories = [...readUploadedPhotos()];
  const customStickers = [...readCustomStickers()];
  for (const photo of memories) {
    if (typeof photo.src === "string" && photo.src.startsWith("data:image/")) {
      photo.src = await uploadImage(photo.src);
    }
  }
  for (const sticker of customStickers) {
    if (
      typeof sticker.src === "string" &&
      sticker.src.startsWith("data:image/")
    ) {
      sticker.src = await uploadImage(sticker.src);
    }
  }
  replaceUploadedPhotos(memories);
  replaceCustomStickers(customStickers);
  await saveState({
    memories,
    customStickers,
    albumSpreads: next,
  });
}

type SaveOptions = {
  memories?: UploadedPhoto[];
  customStickers?: CustomSticker[];
  albumSpreads?: AlbumSpread[];
};

let pendingOptions: SaveOptions | null = null;
let runningSaveLoop = false;

/**
 * Queue an automatic cloud save. The in-memory UI state is already safe in
 * local storage by the time this runs; this loop uploads any leftover raw
 * image bytes to Cloudinary and then replaces the cloud snapshot. Multiple
 * quick edits coalesce into one save — the indicator only shows "Saved ✓"
 * once the cloud accepted the newest state.
 */
export function scheduleSave(options?: SaveOptions): void {
  pendingOptions = options ?? pendingOptions;
  if (!runningSaveLoop) void runSaveLoop();
}

async function runSaveLoop(): Promise<void> {
  runningSaveLoop = true;
  try {
    while (pendingOptions) {
      const options = pendingOptions;
      pendingOptions = null;
      await performSave(options);
    }
  } finally {
    runningSaveLoop = false;
  }
}

async function performSave(options: SaveOptions): Promise<void> {
  const memories = [...(options.memories ?? readUploadedPhotos())];
  const customStickers = [
    ...(options.customStickers ?? readCustomStickers()),
  ];
  const albumSpreads = options.albumSpreads ?? (readAlbumSpreads() ?? []);

  for (const photo of memories) {
    if (typeof photo.src === "string" && photo.src.startsWith("data:image/")) {
      photo.src = await uploadImage(photo.src);
    }
  }
  for (const sticker of customStickers) {
    if (
      typeof sticker.src === "string" &&
      sticker.src.startsWith("data:image/")
    ) {
      sticker.src = await uploadImage(sticker.src);
    }
  }

  replaceUploadedPhotos(memories);
  replaceCustomStickers(customStickers);
  saveAlbumSpreads(albumSpreads);
  await saveState({
    memories,
    customStickers,
    albumSpreads,
  });
}

/**
 * React hook exposing the live save indicator ("Saving… / Saved ✓ /
 * Failed to save"), the cloud status, and a revision counter that bumps
 * whenever a cloud snapshot is applied — components re-read storage on
 * revision change so data from other devices appears automatically.
 */
export function useSaveSyncState(): {
  cloud: CloudSyncStatus;
  saveStatus: SaveStatus;
  saveMessage: string;
  revision: number;
} {
  const { status, message, cloud, revision } = useSaveStatus();
  return {
    cloud,
    saveStatus: status,
    saveMessage: message,
    revision,
  };
}