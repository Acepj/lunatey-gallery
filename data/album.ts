import type { Memory } from "./birthday";

/**
 * Data model for the interactive photo album.
 *
 * Each physical page supports one or several photos that are hand-placed with
 * position, rotation and scale so every page feels like a real scrapbook page.
 */

export type AlbumPhotoStyle = "polaroid" | "print" | "taped";

export type AlbumPhoto = {
  id: string;
  image: string;
  alt: string;
  title: string;
  date: string;
  caption: string;
  style: AlbumPhotoStyle;
  /** horizontal position in % of the page width (left edge) */
  x: number;
  /** vertical position in % of the page height (top edge) */
  y: number;
  /** subtle tilt in degrees */
  rotation: number;
  /** size multiplier */
  scale: number;
  /** width in % of the page width */
  width: number;
  stickerIndex?: number;
  customStickerSrc?: string;
};

export type AlbumAccent = "star" | "heart" | "sun" | "moon" | "quote";

export type AlbumPage = {
  id: string;
  pageNumber: number;
  kind?: "paper" | "endpaper";
  note?: string;
  accent?: AlbumAccent;
  photos: AlbumPhoto[];
};

export type AlbumSpread = {
  id: string;
  left: AlbumPage;
  right: AlbumPage;
};

/** Convert one of the existing gallery memories into an album photo. */
export function memoryToAlbumPhoto(
  memory: Memory,
  overrides: Partial<AlbumPhoto> = {},
): AlbumPhoto {
  return {
    id: `album-photo-${memory.id}`,
    image: memory.src,
    alt: memory.alt,
    title: memory.title,
    date: memory.date,
    caption: memory.caption,
    style: "print",
    x: 20,
    y: 14,
    rotation: -1,
    scale: 1,
    width: 52,
    stickerIndex: memory.stickerIndex,
    customStickerSrc: memory.customStickerSrc,
    ...overrides,
  };
}