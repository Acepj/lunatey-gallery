import { birthday } from "@/data/birthday";
import {
  AlbumPhoto,
  AlbumPage,
  AlbumSpread,
  memoryToAlbumPhoto,
} from "@/data/album";
import type { UploadedPhoto } from "./upload-service";
import {
  readUploadedPhotos,
  removeUploadedPhotosByIds,
  safeWrite,
} from "./upload-service";

const albumStorageKey = "birthday-album-spreads-v2";
const albumUploadStorageKey = "birthday-album-uploads-v2";

/**
 * Drop any album spreads or album uploads saved by older builds, so the book
 * starts image-free and is written entirely through the website.
 */
export function resetLegacyAlbumStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("birthday-album-spreads");
    window.localStorage.removeItem("birthday-album-uploads");
  } catch {
    // ignore — private mode or blocked storage
  }
}

/** Drop unreadable spreads so one bad entry can never break the book. */
function sanitizeSpreads(spreads: unknown): AlbumSpread[] {
  if (!Array.isArray(spreads)) return [];
  return spreads.filter(
    (spread): spread is AlbumSpread =>
      !!spread &&
      typeof spread === "object" &&
      !!spread.left &&
      !!spread.right &&
      Array.isArray((spread as AlbumSpread).left.photos) &&
      Array.isArray((spread as AlbumSpread).right.photos),
  );
}

export function readAlbumSpreads(): AlbumSpread[] | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(albumStorageKey);
  if (!saved) return null;
  try {
    const parsed = sanitizeSpreads(JSON.parse(saved));
    return parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAlbumSpreads(spreads: AlbumSpread[]): void {
  if (typeof window === "undefined") return;
  safeWrite(albumStorageKey, JSON.stringify(spreads));
}

/**
 * Photographs added from inside the album live in their own storage, so they
 * never appear in the memories gallery. The memories gallery has its own
 * storage ("birthday-gallery-uploads") and is never read here.
 */
export function readAlbumUploads(): UploadedPhoto[] {
  if (typeof window === "undefined") return [];
  const saved = window.localStorage.getItem(albumUploadStorageKey);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (photo): photo is UploadedPhoto =>
        !!photo &&
        typeof photo === "object" &&
        typeof (photo as UploadedPhoto).id === "string" &&
        typeof (photo as UploadedPhoto).src === "string",
    );
  } catch {
    return [];
  }
}

export function saveAlbumUpload(photo: UploadedPhoto): void {
  if (typeof window === "undefined") return;
  const existing = readAlbumUploads();
  safeWrite(
    albumUploadStorageKey,
    JSON.stringify([photo, ...existing]),
  );
}

/**
 * Keep only upload records whose photo is still placed inside the saved book.
 * This makes a photo removal permanent: removing a photo from a page (and
 * saving) also drops its upload record, so it can never be re-added later.
 */
export function pruneAlbumUploads(spreads: AlbumSpread[]): void {
  if (typeof window === "undefined") return;
  const placed = new Set<string>();
  for (const spread of spreads) {
    for (const photo of spread.left.photos) placed.add(photo.image);
    for (const photo of spread.right.photos) placed.add(photo.image);
  }
  const remaining = readAlbumUploads().filter((photo) =>
    placed.has(photo.src),
  );
  safeWrite(albumUploadStorageKey, JSON.stringify(remaining));
}

/**
 * Earlier builds wrote album uploads into the shared memories storage.
 * Move any of those back into the album's own storage so the memories
 * gallery only ever shows what was added there.
 */
export function migrateLeakedAlbumUploads(): void {
  if (typeof window === "undefined") return;
  const leaked = readUploadedPhotos().filter((photo) =>
    photo.id.startsWith("album-upload-"),
  );
  if (leaked.length === 0) return;
  const existing = readAlbumUploads();
  const known = new Set(existing.map((photo) => photo.id));
  const toMove = leaked.filter((photo) => !known.has(photo.id));
  if (toMove.length > 0) {
    safeWrite(
      albumUploadStorageKey,
      JSON.stringify([...toMove, ...existing]),
    );
  }
  removeUploadedPhotosByIds(leaked.map((photo) => photo.id));
}

function findMemory(id: string) {
  return birthday.memories.find((memory) => memory.id === id);
}

/**
 * A beautiful pre-made album built from the existing birthday memories.
 * Every spread is composed by hand so pages feel curated and never identical.
 */
function buildCuratedSpreads(): AlbumSpread[] {
  const m = (id: string) => findMemory(id);
  const sunlight = m("sunlight");
  const laugh = m("laugh");
  const greenhouse = m("greenhouse");
  const picnic = m("picnic");
  const profile = m("profile");
  const friends = m("friends");

  if (
    !sunlight ||
    !laugh ||
    !greenhouse ||
    !picnic ||
    !profile ||
    !friends
  ) {
    return [];
  }

  return [
    {
      id: "album-spread-01",
      left: {
        id: "album-page-01",
        pageNumber: 1,
        kind: "endpaper",
        accent: "star",
        note: "Open slowly. Every page holds a little piece of us.",
        photos: [],
      },
      right: {
        id: "album-page-02",
        pageNumber: 2,
        accent: "heart",
        photos: [
          memoryToAlbumPhoto(sunlight, {
            id: "album-photo-sunlight-feature",
            x: 12,
            y: 8,
            width: 72,
            rotation: -1,
            scale: 1,
            style: "print",
          }),
        ],
      },
    },
    {
      id: "album-spread-02",
      left: {
        id: "album-page-03",
        pageNumber: 3,
        accent: "sun",
        note: "This page is loud, the way your laugh is.",
        photos: [
          memoryToAlbumPhoto(laugh, {
            id: "album-photo-laugh-taped",
            x: 10,
            y: 12,
            width: 74,
            rotation: 1.5,
            scale: 1,
            style: "taped",
          }),
        ],
      },
      right: {
        id: "album-page-04",
        pageNumber: 4,
        accent: "moon",
        note: "Golden hour, golden you.",
        photos: [
          memoryToAlbumPhoto(greenhouse, {
            id: "album-photo-greenhouse-polaroid",
            x: 20,
            y: 12,
            width: 46,
            rotation: -3,
            scale: 1.02,
            style: "polaroid",
          }),
        ],
      },
    },
    {
      id: "album-spread-03",
      left: {
        id: "album-page-05",
        pageNumber: 5,
        accent: "star",
        note: "A good day with good people.",
        photos: [
          memoryToAlbumPhoto(picnic, {
            id: "album-photo-picnic-print",
            x: 16,
            y: 14,
            width: 58,
            rotation: 2.5,
            scale: 1,
            style: "print",
          }),
        ],
      },
      right: {
        id: "album-page-06",
        pageNumber: 6,
        accent: "quote",
        note: "The moments before a memory becomes one.",
        photos: [
          memoryToAlbumPhoto(profile, {
            id: "album-photo-profile-polaroid",
            x: 26,
            y: 10,
            width: 40,
            rotation: -2,
            scale: 1.02,
            style: "polaroid",
          }),
        ],
      },
    },
    {
      id: "album-spread-04",
      left: {
        id: "album-page-07",
        pageNumber: 7,
        accent: "sun",
        photos: [
          memoryToAlbumPhoto(friends, {
            id: "album-photo-friends-taped",
            x: 8,
            y: 13,
            width: 78,
            rotation: -1.5,
            scale: 1,
            style: "taped",
          }),
        ],
      },
      right: {
        id: "album-page-08",
        pageNumber: 8,
        accent: "heart",
        note: "Some moments deserve a second page.",
        photos: [
          memoryToAlbumPhoto(sunlight, {
            id: "album-photo-sunlight-again",
            x: 24,
            y: 12,
            width: 44,
            rotation: 2,
            scale: 0.98,
            style: "polaroid",
          }),
        ],
      },
    },
    {
      id: "album-spread-05",
      left: {
        id: "album-page-09",
        pageNumber: 9,
        accent: "quote",
        note: "Stay a while.",
        photos: [
          memoryToAlbumPhoto(greenhouse, {
            id: "album-photo-greenhouse-small",
            x: 18,
            y: 16,
            width: 52,
            rotation: -1,
            scale: 1,
            style: "print",
          }),
        ],
      },
      right: {
        id: "album-page-10",
        pageNumber: 10,
        accent: "moon",
        note: "The best pages are still empty.",
        photos: [],
      },
    },
  ];
}

function blankPage(
  id: string,
  pageNumber: number,
  accent?: "star" | "heart" | "sun" | "moon" | "quote",
): AlbumPage {
  return { id, pageNumber, accent, photos: [] };
}

/** Append uploaded photos as fresh spreads (two per spread). */
function buildUploadSpreads(
  uploaded: ReturnType<typeof readUploadedPhotos>,
): AlbumSpread[] {
  const spreads: AlbumSpread[] = [];
  let pageCounter = 1;
  for (let i = 0; i < uploaded.length; i += 2) {
    const photos: AlbumPhoto[] = [];
    const first = uploaded[i];
    photos.push({
      id: `album-photo-up-${first.id}`,
      image: first.src,
      alt: first.alt,
      title: first.title,
      date: first.date,
      caption: first.caption,
      style: i % 4 === 0 ? "polaroid" : "taped",
      x: i % 2 === 0 ? 14 : 22,
      y: 12,
      rotation: (i % 3) - 1.5,
      scale: 1,
      width: 50,
      stickerIndex: first.stickerIndex,
      customStickerSrc: first.customStickerSrc,
    });
    const second = uploaded[i + 1];
    if (second) {
      photos.push({
        id: `album-photo-up-${second.id}`,
        image: second.src,
        alt: second.alt,
        title: second.title,
        date: second.date,
        caption: second.caption,
        style: i % 4 === 1 ? "print" : "polaroid",
        x: 30,
        y: 32,
        rotation: i % 3 === 0 ? 1.5 : -1,
        scale: 0.95,
        width: 42,
        stickerIndex: second.stickerIndex,
        customStickerSrc: second.customStickerSrc,
      });
    }
    const leftPage = {
      id: `album-page-up-left-${i}`,
      pageNumber: pageCounter++,
      accent: (i % 2 === 0 ? "star" : "heart") as "star" | "heart",
      photos: photos[0] ? [photos[0]] : [],
    };
    const right = blankPage(
      `album-page-up-right-${i}`,
      pageCounter++,
      "quote",
    );
    if (photos[1]) {
      right.photos = [photos[1]];
    }
    spreads.push({
      id: `album-spread-up-${i}`,
      left: leftPage,
      right,
    });
  }
  return spreads;
}

/**
 * The album as every visitor sees it: only the hand-curated pages that ship
 * with the site. The celebrant's own photographs are never included here.
 */
export function buildCuratedAlbum(): AlbumSpread[] {
  const curated = buildCuratedSpreads();
  return curated.length > 0 ? curated : buildEmptyAlbum();
}

/** A calm placeholder spread, so an unwritten book still opens safely. */
function buildEmptyAlbum(): AlbumSpread[] {
  return [
    {
      id: "album-spread-empty",
      left: {
        id: "album-page-empty-left",
        pageNumber: 1,
        kind: "endpaper",
        accent: "quote",
        note: "The pages are waiting to be written.",
        photos: [],
      },
      right: {
        id: "album-page-empty-right",
        pageNumber: 2,
        accent: "star",
        note: "Add your first photograph, and it becomes page one. This little book grows the way memories do — one quiet moment at a time.",
        photos: [],
      },
    },
  ];
}

/**
 * The initial album = curated spreads followed by every uploaded memory,
 * so the celebrant's own photos appear naturally inside the book.
 */
export function buildInitialAlbum(): AlbumSpread[] {
  const curated = buildCuratedSpreads();
  const uploaded = readAlbumUploads();
  if (curated.length === 0 && uploaded.length === 0) {
    return buildEmptyAlbum();
  }
  return [...curated, ...buildUploadSpreads(uploaded)];
}