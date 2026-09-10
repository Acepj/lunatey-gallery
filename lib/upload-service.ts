

export type UploadedPhoto = {
  id: string;
  src: string;
  alt: string;
  title: string;
  date: string;
  caption: string;
  layout: "tall" | "wide" | "square" | "feature";
  stickerIndex?: number;
  customStickerSrc?: string;
  stickerPositionX?: number;
  stickerPositionY?: number;
  stickerScale?: number;
  stickerRotation?: number;
};

export type CustomSticker = {
  id: string;
  src: string;
};

const photoStorageKey = "birthday-gallery-uploads";
const stickerStorageKey = "birthday-custom-stickers";
const cachedImageUrlPrefix = "lunatey-image-url-cache:";

function cacheImageUrl(key: string, url: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cachedImageUrlPrefix + key, url);
  } catch {
    // ignore
  }
}

function readCachedImageUrl(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(cachedImageUrlPrefix + key) ?? null;
  } catch {
    return null;
  }
}

/**
 * Crash-safe localStorage write. Browsers can refuse writes when storage is
 * full (many large photos over a long time) or blocked (private mode) — the
 * site must keep working either way.
 */
export function safeWrite(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(
      "Birthday site: storage is full or unavailable. Free some space or remove a few photos.",
      error,
    );
    window.dispatchEvent(new CustomEvent("birthday-storage-full"));
    return false;
  }
}

/** Drop anything unreadable so one bad entry can never break the gallery. */
function sanitizePhotos(photos: unknown): UploadedPhoto[] {
  if (!Array.isArray(photos)) return [];
  return photos.filter(
    (photo): photo is UploadedPhoto =>
      !!photo &&
      typeof photo === "object" &&
      typeof (photo as UploadedPhoto).id === "string" &&
      typeof (photo as UploadedPhoto).src === "string",
  );
}

export function readUploadedPhotos(): UploadedPhoto[] {
  if (typeof window === "undefined") return [];
  const saved = window.localStorage.getItem(photoStorageKey);
  if (!saved) return [];
  try {
    return sanitizePhotos(JSON.parse(saved));
  } catch {
    return [];
  }
}

export function saveUploadedPhoto(photo: UploadedPhoto): void {
  saveUploadedPhotos([photo]);
}

export function saveUploadedPhotos(photos: UploadedPhoto[]): void {
  if (typeof window === "undefined" || photos.length === 0) return;
  const existing = readUploadedPhotos();
  safeWrite(
    photoStorageKey,
    JSON.stringify([...photos, ...existing]),
  );
}

/**
 * Overwrite the whole uploaded-photos list in one write. Used by the cloud
 * sync layer so a pulled or pushed snapshot can never duplicate what is
 * already in storage (the prepending variant above is only for brand-new
 * uploads).
 */
export function replaceUploadedPhotos(photos: UploadedPhoto[]): boolean {
  if (typeof window === "undefined") return false;
  return safeWrite(photoStorageKey, JSON.stringify(photos));
}

export function removeUploadedPhoto(id: string): void {
  removeUploadedPhotosByIds([id]);
}

export function removeUploadedPhotosByIds(ids: string[]): void {
  if (typeof window === "undefined" || ids.length === 0) return;
  const idSet = new Set(ids);
  const remaining = readUploadedPhotos().filter(
    (photo) => !idSet.has(photo.id),
  );
  safeWrite(photoStorageKey, JSON.stringify(remaining));
}

export function updateUploadedPhoto(
  id: string,
  updates: Partial<UploadedPhoto>,
): UploadedPhoto | null {
  const existing = readUploadedPhotos();
  let updatedPhoto: UploadedPhoto | null = null;
  const updated = existing.map((photo) => {
    if (photo.id !== id) return photo;
    updatedPhoto = { ...photo, ...updates, id: photo.id };
    return updatedPhoto;
  });
  if (!updatedPhoto) return null;
  safeWrite(photoStorageKey, JSON.stringify(updated));
  return updatedPhoto;
}

export function isImageFile(file: File): boolean {
  if (file.type) return file.type.toLowerCase().startsWith("image/");
  // Some mobile browsers omit the MIME type — fall back to the extension.
  return /\.(png|jpe?g|gif|webp|bmp|avif|svg|heic|heif)$/i.test(file.name || "");
}

export function readCustomStickers(): CustomSticker[] {
  if (typeof window === "undefined") return [];
  const saved = window.localStorage.getItem(stickerStorageKey);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (sticker): sticker is CustomSticker =>
        !!sticker &&
        typeof sticker === "object" &&
        typeof (sticker as CustomSticker).id === "string" &&
        typeof (sticker as CustomSticker).src === "string",
    );
  } catch {
    return [];
  }
}

export function saveCustomSticker(sticker: CustomSticker): boolean {
  return saveCustomStickers([sticker]);
}

/**
 * Prepend a batch of stickers in one write, preserving their order.
 * (Saving one-by-one inside a loop reverses the batch in storage, which
 * would desync the picker's highlight indices from the stored list.)
 * Returns false when the write failed (storage full/blocked) so callers
 * can still keep the stickers in memory and tell the user.
 */
export function saveCustomStickers(stickers: CustomSticker[]): boolean {
  if (typeof window === "undefined" || stickers.length === 0) return false;
  const existing = readCustomStickers();
  const ok = safeWrite(
    stickerStorageKey,
    JSON.stringify([...stickers, ...existing]),
  );
  if (ok) notifyStickersChanged();
  return ok;
}

/** Overwrite the whole sticker list in one write (used by the cloud layer). */
export function replaceCustomStickers(stickers: CustomSticker[]): boolean {
  if (typeof window === "undefined") return false;
  const ok = safeWrite(stickerStorageKey, JSON.stringify(stickers));
  if (ok) notifyStickersChanged();
  return ok;
}

export function removeCustomSticker(id: string): void {
  const remaining = readCustomStickers().filter((s) => s.id !== id);
  if (safeWrite(stickerStorageKey, JSON.stringify(remaining))) {
    notifyStickersChanged();
  }
}

/** Tell every open sticker picker to re-read the shared sticker list. */
function notifyStickersChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("birthday-stickers-changed"));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    // Chunked deliberately: String.fromCharCode(...) with a huge spread can
    // overflow some browsers' argument stack on large phone photos.
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    const mime = file.type || "application/octet-stream";
    return `data:${mime};base64,${btoa(binary)}`;
  });
}

/**
 * Downscale + recompress a photograph before it is stored, so the browser's
 * localStorage (a few MB) can comfortably hold years of memories instead of
 * filling up after a handful of phone-sized originals.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1400,
  quality = 0.82,
): Promise<string> {
  const source = await readFileAsDataUrl(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = document.createElement("img");
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = source;
    });
    const longest = Math.max(image.width, image.height);
    const scale = Math.min(1, maxDimension / longest);
    if (scale >= 1 && source.length < 400_000) return source;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return source;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL("image/jpeg", quality);
    return compressed.length < source.length ? compressed : source;
  } catch {
    // If decoding fails (rare formats), keep the original — never lose a photo.
    return source;
  }
}

let stickerIdCounter = 0;

/**
 * Upload an image data URL to Cloudinary via the API route, with a local
 * cache so a repeated upload never re-sends the same bytes.
 */
export async function uploadImage(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    throw new Error("uploadImage needs a valid image data URL");
  }
  // break circular: uploadImage lives here (upload-service), not in
  // gallery-cloud — gallery-cloud imports from this module
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
    // If the server is unreachable, keep the data URL so the photo is not lost.
    // It will be retried next time saving is attempted.
    console.error(
      "Birthday site: cloud upload failed, keeping local copy:",
      error,
    );
    return dataUrl;
  }
}

export async function uploadSticker(file: File): Promise<CustomSticker> {
  const compressed = await compressImageFile(file, 320, 0.85);
  const url = await uploadImage(compressed);
  stickerIdCounter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return {
    id: `sticker-${Date.now()}-${stickerIdCounter}-${random}-${file.name}`,
    src: url,
  };
}

export async function uploadPhoto(
  file: File,
  stickerIndex?: number,
  customStickerSrc?: string,
  withSticker?: { posX: number; posY: number; scale: number; rotation: number },
  layout?: UploadedPhoto["layout"],
): Promise<UploadedPhoto> {
  const compressed = await compressImageFile(file);
  const url = await uploadImage(compressed);
  const id = `cloudinary-${Date.now()}-${file.name}`;

  return {
    id,
    src: url,
    alt: file.name.replace(/\.[^/.]+$/, ""),
    title: "A new memory",
    date: "Just now",
    caption: "A moment worth keeping.",
    layout: layout ?? "square",
    stickerIndex,
    customStickerSrc,
    ...(withSticker
      ? {
          stickerPositionX: withSticker.posX,
          stickerPositionY: withSticker.posY,
          stickerScale: withSticker.scale,
          stickerRotation: withSticker.rotation,
        }
      : {
          stickerPositionX: 78,
          stickerPositionY: 78,
          stickerScale: 1,
          stickerRotation: -4,
        }),
  };
}

export async function replaceUploadedPhoto(
  id: string,
  file: File,
): Promise<UploadedPhoto | null> {
  const existing = readUploadedPhotos().find((photo) => photo.id === id);
  if (!existing) return null;
  const url = await uploadImage(await compressImageFile(file));
  return updateUploadedPhoto(id, {
    src: url,
    alt: file.name.replace(/\.[^/.]+$/, ""),
  });
}
