import type { AlbumPhoto, AlbumSpread } from "@/data/album";
import type { UploadedPhoto } from "./upload-service";
import {
  readUploadedPhotos,
  replaceUploadedPhotos,
} from "./upload-service";
import {
  readAlbumSpreads,
  readAlbumUploads,
  replaceAlbumUploads,
  saveAlbumSpreads,
} from "./album-service";

/**
 * Sample pictures for a brand‑new visitor.
 *
 * On the very first load the site fills the Memories wall with these six
 * sample photographs and the Album with this ten‑photo book. They are written
 * into the exact same per‑device storage the celebrant uses, so every single
 * one stays fully editable — change the title, date, caption, sticker, move /
 * resize it inside the book, or remove it — exactly like a photo she adds
 * herself. When the sample set below is edited (new pictures, captions,
 * stickers...), bump `SAMPLES_VERSION` and every browser that already stored
 * the older samples re-syncs them on its next load.
 */

const seedSentinelKey = "lunatey-sample-pictures-seeded-v1";
const samplesVersionKey = "lunatey-sample-pictures-version";

/**
 * Bump this version whenever the sample set above is edited (new pictures,
 * captions, stickers...). Every browser that already stored the older samples
 * will re-sync them to the current set on its next load — that is exactly how
 * a picture swap in this file reaches an already-open browser. New browsers
 * get the samples on first run either way.
 */
const SAMPLES_VERSION = 2;

/* ---------- Memories wall: six samples, one sticker each ---------- */

export const SAMPLE_MEMORIES: UploadedPhoto[] = [
  {
    id: "sample-memory-01",
    src: "/img/luna27.jpg",
    alt: "Lunatey in a soft golden light",
    title: "First light",
    date: "Spring 2024",
    caption: "Some moments begin quietly, and this one stayed.",
    layout: "feature",
    stickerIndex: 0,
    stickerPositionX: 80,
    stickerPositionY: 72,
    stickerScale: 1,
    stickerRotation: -4,
  },
  {
    id: "sample-memory-02",
    src: "/img/smilee.jpg",
    alt: "Lunatey smiling in the warm sun",
    title: "Golden smile",
    date: "Summer 2024",
    caption: "That kind of smile that makes the whole day better.",
    layout: "wide",
    stickerIndex: 1,
    stickerPositionX: 68,
    stickerPositionY: 20,
    stickerScale: 0.95,
    stickerRotation: 6,
  },
  {
    id: "sample-memory-03",
    src: "/img/luna29.jpg",
    alt: "A quiet afternoon portrait",
    title: "Quiet days",
    date: "Autumn 2024",
    caption: "Not every day is loud — some are made for remembering.",
    layout: "tall",
    stickerIndex: 2,
    stickerPositionX: 30,
    stickerPositionY: 26,
    stickerScale: 0.9,
    stickerRotation: -6,
  },
  {
    id: "sample-memory-04",
    src: "/img/thea8.jpg",
    alt: "Lunatey mid-laugh",
    title: "Little joys",
    date: "December 2024",
    caption: "Little joys, big heart — the best kind of moments.",
    layout: "square",
    stickerIndex: 3,
    stickerPositionX: 26,
    stickerPositionY: 76,
    stickerScale: 1.05,
    stickerRotation: -3,
  },
  {
    id: "sample-memory-05",
    src: "/img/thea2.jpg",
    alt: "Lunatey laughing on a bright day",
    title: "Sweet moments",
    date: "January 2025",
    caption: "Some laughs are too bright not to keep forever.",
    layout: "wide",
    stickerIndex: 4,
    stickerPositionX: 76,
    stickerPositionY: 74,
    stickerScale: 0.92,
    stickerRotation: 5,
  },
  {
    id: "sample-memory-06",
    src: "/img/luna23.jpg",
    alt: "Lunatey glowing in the evening light",
    title: "You glow",
    date: "February 2025",
    caption: "Even the quietest evenings look warmer when you are in them.",
    layout: "square",
    stickerIndex: 5,
    stickerPositionX: 30,
    stickerPositionY: 64,
    stickerScale: 1,
    stickerRotation: 8,
  },
];

/* ---------- Album: a hand-placed ten-photo book, one sticker each ---------- */

export const SAMPLE_ALBUM_SPREADS: AlbumSpread[] = [
  {
    id: "album-sample-spread-01",
    left: {
      id: "album-sample-page-01",
      pageNumber: 1,
      kind: "endpaper",
      accent: "star",
      note: "Open slowly. Every page holds a little piece of us.",
      photos: [],
    },
    right: {
      id: "album-sample-page-02",
      pageNumber: 2,
      accent: "heart",
      note: "A few of my favourite little moments.",
      photos: [
        {
          id: "album-sample-01",
          image: "/img/luna2.jpg",
          alt: "Lunatey at the start of a sunny day",
          title: "A lovely start",
          date: "Spring 2024",
          caption: "Every album has to begin somewhere — this felt like the right page.",
          style: "print",
          x: 12,
          y: 8,
          rotation: -1,
          scale: 1,
          width: 72,
          stickerIndex: 0,
        },
      ],
    },
  },
  {
    id: "album-sample-spread-02",
    left: {
      id: "album-sample-page-03",
      pageNumber: 3,
      accent: "sun",
      note: "This page is loud, the way your laugh is.",
      photos: [
        {
          id: "album-sample-02",
          image: "/img/luna3.jpg",
          alt: "Lunatey full of laughter",
          title: "Loud like your laugh",
          date: "Summer 2024",
          caption: "This page is loud, the way your laugh is.",
          style: "taped",
          x: 8,
          y: 10,
          rotation: 1.2,
          scale: 1,
          width: 78,
          stickerIndex: 1,
        },
      ],
    },
    right: {
      id: "album-sample-page-04",
      pageNumber: 4,
      accent: "moon",
      note: "Golden hour, golden you.",
      photos: [
        {
          id: "album-sample-03",
          image: "/img/luna4.jpg",
          alt: "Lunatey in golden hour light",
          title: "Golden hour",
          date: "Summer 2024",
          caption: "Golden hour, golden you.",
          style: "polaroid",
          x: 12,
          y: 8,
          rotation: -2,
          scale: 1.02,
          width: 44,
          stickerIndex: 2,
        },
        {
          id: "album-sample-04",
          image: "/img/luna6.jpg",
          alt: "A candid in-between moment",
          title: "In between",
          date: "August 2024",
          caption: "The moments between the ones we planned.",
          style: "print",
          x: 28,
          y: 44,
          rotation: 1.5,
          scale: 0.96,
          width: 40,
          stickerIndex: 3,
        },
      ],
    },
  },
  {
    id: "album-sample-spread-03",
    left: {
      id: "album-sample-page-05",
      pageNumber: 5,
      accent: "quote",
      note: "A good day with good people.",
      photos: [
        {
          id: "album-sample-05",
          image: "/img/luna7.jpg",
          alt: "Lunatey on a good day",
          title: "Good days",
          date: "October 2024",
          caption: "A good day with good people.",
          style: "print",
          x: 14,
          y: 12,
          rotation: 2,
          scale: 1,
          width: 60,
          stickerIndex: 4,
        },
      ],
    },
    right: {
      id: "album-sample-page-06",
      pageNumber: 6,
      accent: "star",
      note: "Some moments deserve a second look.",
      photos: [
        {
          id: "album-sample-06",
          image: "/img/luna8.jpg",
          alt: "Lunatey looking back at the camera",
          title: "Second look",
          date: "October 2024",
          caption: "Some moments deserve a second look.",
          style: "polaroid",
          x: 10,
          y: 6,
          rotation: -1.5,
          scale: 1,
          width: 46,
          stickerIndex: 5,
        },
        {
          id: "album-sample-07",
          image: "/img/luna10.jpg",
          alt: "A small still from the day",
          title: "Found stills",
          date: "November 2024",
          caption: "Small stills from days I never want to misplace.",
          style: "taped",
          x: 28,
          y: 44,
          rotation: 1,
          scale: 0.97,
          width: 42,
          stickerIndex: 0,
        },
      ],
    },
  },
{
    id: "album-sample-spread-04",
    left: {
      id: "album-sample-page-07",
      pageNumber: 7,
      accent: "heart",
      note: "You always shine brightest.",
      photos: [
        {
          id: "album-sample-08",
          image: "/img/luna11.jpg",
          alt: "Lunatey full of light",
          title: "Shine bright",
          date: "January 2025",
          caption: "You always shine brightest on your own.",
          style: "print",
          x: 14,
          y: 10,
          rotation: -1.2,
          scale: 1,
          width: 62,
          stickerIndex: 1,
        },
      ],
    },
    right: {
      id: "album-sample-page-08",
      pageNumber: 8,
      accent: "sun",
      note: "Stay a while — the best is still being written.",
      photos: [
        {
          id: "album-sample-09",
          image: "/img/thea1.jpg",
          alt: "A warm portrait to linger on",
          title: "Stay a while",
          date: "January 2025",
          caption: "Stay a while — the best is still being written.",
          style: "polaroid",
          x: 12,
          y: 8,
          rotation: 1.8,
          scale: 1,
          width: 56,
          stickerIndex: 2,
        },
      ],
    },
  },
  {
    id: "album-sample-spread-05",
    left: {
      id: "album-sample-page-09",
      pageNumber: 9,
      accent: "star",
      note: "More pages are waiting to be written.",
      photos: [
        {
          id: "album-sample-10",
          image: "/img/thea3.jpg",
          alt: "One more moment worth keeping",
          title: "More to come",
          date: "February 2025",
          caption: "The last page for now, but never the last page.",
          style: "taped",
          x: 10,
          y: 10,
          rotation: -1,
          scale: 1,
          width: 54,
          stickerIndex: 3,
        },
      ],
    },
    right: {
      id: "album-sample-page-10",
      pageNumber: 10,
      accent: "quote",
      note: "The best pages are still empty.",
      photos: [],
    },
  },
];
/** Mirror of the upload records the cloud layer derives from the book. */
function sampleAlbumUploads(): UploadedPhoto[] {
  const uploads: UploadedPhoto[] = [];
  for (const spread of SAMPLE_ALBUM_SPREADS) {
    for (const photo of spread.left.photos) {
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

/** Flat list of every sample album photo (used for in-book refreshes). */
function sampleAlbumPhotos(): AlbumPhoto[] {
  const photos: AlbumPhoto[] = [];
  for (const spread of SAMPLE_ALBUM_SPREADS) {
    photos.push(...spread.left.photos, ...spread.right.photos);
  }
  return photos;
}

/**
 * One-time, per-device seed of the sample pictures. Runs on every load but is
 * a no-op once the stored sample-set version matches `SAMPLES_VERSION`. When
 * the samples are edited in this file (new pictures, captions, stickers), the
 * version is bumped and already-open browsers re-sync on their next load:
 *
 * - Memories wall: every stored sample picture is replaced by its current
 *   definition (so a picture swap actually shows up), and any sample that is
 *   missing is added. Real user photos are never touched.
 * - Album: sample photos still in the saved book are updated to the current
 *   set, and a missing/empty book is seeded with the sample album. Real album
 *   photos and their layout are never touched.
 *
 * After that the version is stored, so the celebrant's own edits to the
 * samples (caption, sticker, position...) are preserved until the next bump.
 */
export function seedSamplePictures(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const storedVersion = Number(
      window.localStorage.getItem(samplesVersionKey) ?? "0",
    );
    const versionStale = storedVersion < SAMPLES_VERSION;

    let changed = false;

    // --- Memories wall ----------------------------------------------------
    // Refresh when the stored sample set is outdated: either the sample
    // version was bumped, or a stored sample's image no longer matches the
    // current definition (a cloud snapshot may have re-applied old images).
    // Stored samples are replaced by their current definitions and any
    // missing sample is added; real user photos are never touched.
    const existingPhotos = readUploadedPhotos();
    const memoryDefs = new Map(
      SAMPLE_MEMORIES.map((memory) => [memory.id, memory]),
    );
    const missing = SAMPLE_MEMORIES.filter(
      (memory) => !existingPhotos.some((photo) => photo.id === memory.id),
    );
    const memoryStale = SAMPLE_MEMORIES.some((memory) => {
      const stored = existingPhotos.find((photo) => photo.id === memory.id);
      return !!stored && stored.src !== memory.src;
    });

    if (versionStale || memoryStale) {
      const merged = existingPhotos.map((photo) =>
        memoryDefs.has(photo.id) ? { ...memoryDefs.get(photo.id)! } : photo,
      );
      for (const memory of missing) merged.unshift(memory);
      replaceUploadedPhotos(merged);
      changed = true;
    }

    // --- Album ------------------------------------------------------------
    // With a saved book: refresh any sample photo still inside it whose image
    // changed. Without a book (or with a completely empty one): seed the
    // sample album. Real album photos and their layout are never touched.
    const savedSpreads = readAlbumSpreads();
    const bookHasPhotos = (savedSpreads ?? []).some(
      (spread) =>
        spread.left.photos.length > 0 || spread.right.photos.length > 0,
    );

    if (savedSpreads && bookHasPhotos) {
      const albumDefs = new Map(
        sampleAlbumPhotos().map((photo) => [photo.id, photo]),
      );
      const isAlbumStale = sampleAlbumPhotos().some((def) =>
        savedSpreads.some((spread) =>
          [...spread.left.photos, ...spread.right.photos].some(
            (photo) => photo.id === def.id && photo.image !== def.image,
          ),
        ),
      );
      const refreshSide = (photos: AlbumPhoto[]): AlbumPhoto[] =>
        photos.map((photo) =>
          albumDefs.has(photo.id) ? { ...albumDefs.get(photo.id)! } : photo,
        );

      if (versionStale || isAlbumStale) {
        const nextSpreads = savedSpreads.map((spread) => ({
          ...spread,
          left: {
            ...spread.left,
            photos: refreshSide(spread.left.photos),
          },
          right: {
            ...spread.right,
            photos: refreshSide(spread.right.photos),
          },
        }));
        const bookUpdated = nextSpreads.some((spread, s) => {
          const original = savedSpreads[s];
          return (
            spread.left.photos.some(
              (photo, i) => photo.image !== original.left.photos[i]?.image,
            ) ||
            spread.right.photos.some(
              (photo, i) => photo.image !== original.right.photos[i]?.image,
            )
          );
        });
        if (bookUpdated) {
          saveAlbumSpreads(nextSpreads);
          // Keep the album-upload records in step with the refreshed book so
          // the old sample image slots can never leak back in or duplicate.
          const uploads = readAlbumUploads();
          const albumUploadDefs = new Map(
            sampleAlbumUploads().map((upload) => [upload.id, upload]),
          );
          const nextUploads = uploads.map((upload) => {
            const def = albumUploadDefs.get(upload.id);
            return def && def.src !== upload.src ? { ...def } : upload;
          });
          replaceAlbumUploads(nextUploads);
          changed = true;
        }
      }
    } else if (versionStale) {
      saveAlbumSpreads(SAMPLE_ALBUM_SPREADS);
      replaceAlbumUploads(sampleAlbumUploads());
      changed = true;
    }

    if (versionStale || changed) {
      window.localStorage.setItem(samplesVersionKey, String(SAMPLES_VERSION));
      window.localStorage.setItem(seedSentinelKey, "1");
    }
    return changed;
  } catch {
    // Private mode or blocked storage — the page must keep working either way.
    return false;
  }
}