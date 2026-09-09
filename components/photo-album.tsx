"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { birthday } from "@/data/birthday";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ImagePlus,
  Music,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { AlbumPage, AlbumPhoto, AlbumSpread } from "@/data/album";
import {
  buildCuratedAlbum,
  buildInitialAlbum,
  migrateLeakedAlbumUploads,
  pruneAlbumUploads,
  readAlbumSpreads,
  readAlbumUploads,
  resetLegacyAlbumStorage,
  saveAlbumSpreads,
  saveAlbumUpload,
} from "@/lib/album-service";
import {
  isImageFile,
  readCustomStickers,
  saveCustomStickers,
  uploadSticker,
} from "@/lib/upload-service";
import type { CustomSticker } from "@/lib/upload-service";
import {
  checkCloudSync,
  noteLocalAlbumSave,
  pullCloudAlbum,
  pushCloudAlbum,
  type CloudSyncStatus,
} from "@/lib/album-sync";
import {
  getCustomStickerSrc,
  getStickerIndex,
  MemorySticker,
  stickerDesigns,
} from "./stickers";

const ease = [0.22, 1, 0.36, 1] as const;
const flipTime = 0.95;
const flipMs = 1040;

/* Clicks that arrive right after a real drag must be ignored — otherwise
   finishing a drag would pop the photo editor open by accident and it feels
   like taps "sometimes don't work". Drag code stamps this on release. */
let suppressPhotoClickUntil = 0;

/**
 * Drop sticker rows that could never render or be re-selected — an empty src
 * can come from an interrupted upload, and it would show an empty circle that
 * taps "select" but then paints nothing on the photo.
 */
function sanitizeStickers(stickers: CustomSticker[]): CustomSticker[] {
  return stickers.filter(
    (sticker) =>
      !!sticker &&
      typeof sticker.id === "string" &&
      sticker.id.length > 0 &&
      typeof sticker.src === "string" &&
      sticker.src.length > 0,
  );
}

/* ---------- album music (plays "First And Last" once, off by default) ---------- */

let albumAudio: HTMLAudioElement | null = null;
let onMusicEnded: (() => void) | null = null;

/** Register a callback that runs when the song finishes on its own. */
export function setOnMusicEnded(callback: (() => void) | null): void {
  onMusicEnded = callback;
}

/** Begin the album music. Only ever starts from a user click. */
export function startAlbumMusic(): void {
  stopAlbumMusic();
  try {
    const audio = new Audio("/music/first-and-last.mp4");
    audio.loop = false;
    audio.volume = 0.09;
    audio.onended = () => {
      if (albumAudio !== audio) return;
      albumAudio = null;
      onMusicEnded?.();
    };
    void audio.play();
    albumAudio = audio;
  } catch {
    // Music is optional — never break the experience.
  }
}

/** Stop the music right away. Safe to call more than once. */
export function stopAlbumMusic(): void {
  const audio = albumAudio;
  albumAudio = null;
  if (!audio || audio.paused) return;
  audio.pause();
  try {
    audio.currentTime = 0; // rewind so the next play starts from the top
  } catch {
    // ignore
  }
}

/* ---------- tiny helpers ---------- */

function writeAdditionalProps(p: AlbumPhoto): AlbumPhoto {
  return p;
}

function getPhotoDelay(index: number): string {
  return `${((index * 2.9) % 7).toFixed(1)}s`;
}

/** Small gold decorative glyphs that quietly float on some pages. */
function AccentGlyph({ accent, side }: { accent: NonNullable<AlbumPage["accent"]>; side: "left" | "right" }) {
  const paths: Record<string, React.ReactNode> = {
    star: <path d="M12 2 L15 7 L12 12 L9 7 L6 2 L9 -1 Z M12 12 L15 17 L12 22 L9 17 Z" fill="none" stroke="#caaa6e" strokeWidth="1.4" />,
    heart: <path d="M6 13 C4 9 4 6 8 5 C12 6 13 8 13 12 C10 14 6 16 4 15 C3 14 4 13 5 14 C6 17 8 20 11 21 C14 21 16 19 17 17 C18 16 18 15 17 14 C17 13 16 12 15 13 Z" fill="none" stroke="#caaa6e" strokeWidth="1.2" />,
    sun: <path d="M12 12 m-8 0 a8 8 0 1 0 16 0 a8 8 0 0 0 -16 0 Z M3 1 L3 5 M21 1 L21 5 M1 7 L1 11 M23 7 L23 11 M4 23 L4 19 M20 23 L20 19 M7 24 L7 20 M17 24 L17 20" fill="none" stroke="#caaa6e" strokeWidth="1.3" />,
    moon: <path d="M12 12 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 Z M15 11 a3 3 0 1 0 4 0 a3 3 0 1 0 -4 0 Z" fill="none" stroke="#caaa6e" strokeWidth="1.4" />,
    quote: <path d="M5 6 C5 12 7 18 12 18 C17 18 19 12 19 6 Z M12 12 L12 13" fill="none" stroke="#caaa6e" strokeWidth="1.5" />,
  };
  return (
    <div
      className={`pointer-events-none absolute ${side === "left" ? "right-2.5 top-2.5" : "left-2.5 top-2.5"} opacity-70`}
      style={{ animation: "album-star-pulse 9s ease-in-out infinite" }}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        {paths[accent]}
      </svg>
    </div>
  );
}

/** A small handwritten note card tucked onto a page. */
function AlbumNote({ text, side }: { text: string; side: "left" | "right" }) {
  return (
    <div
      className="album-note pointer-events-none absolute bottom-14 left-1/2 w-[64%] -translate-x-1/2 rounded-[5px] px-3 py-2.5 opacity-90"
      style={{ transform: side === "left" ? "translateX(-50%) rotate(-1.4deg)" : "translateX(-50%) rotate(1.1deg)" }}
    >
      <p className="album-handwritten text-[9px] leading-4 text-[#5d452f]">
        {text}
      </p>
    </div>
  );
}

/** Inside-cover / endpaper layout for the first left page. */
function EndpaperContent({ page }: { page: AlbumPage }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="h-px w-16 bg-[#caaa6e]/60" />
      <p className="font-serif text-xl italic tracking-[0.06em] text-[#e6cfa2]">
        A Little Album
      </p>
      <span className="rotate-45 text-[#d8b77e] text-[11px]">&#10086;</span>
      {page.note ? (
        <p className="album-handwritten text-[10px] leading-4 text-[#d8c3a0]">
          {page.note}
        </p>
      ) : null}
      <span className="mt-2 h-px w-10 bg-[#caaa6e]/40" />
      <p className="font-serif text-[8px] italic uppercase tracking-[0.3em] text-[#caa876]">
        Made by Amorth
      </p>
    </div>
  );
}
/* ---------- a single photograph placed on an album page ---------- */

function AlbumPhotoFrame({ photo }: { photo: AlbumPhoto }) {
  if (photo.style === "polaroid") {
    return (
      <div className="rounded-[2px] bg-[#f4edda] p-2.5 shadow-xl shadow-black/45 sm:p-3.5">
        <img
          src={photo.image}
          alt={photo.alt}
          loading="lazy"
          className="aspect-[1/1.06] w-full object-cover object-center saturate-[0.75]"
        />
        <div className="mt-1.5 border-t border-[#d9c9a4]/60 px-1 pt-1.5">
          <p className="album-handwritten text-[8.5px] leading-3 text-[#5d452f]">
            {photo.title}
            {photo.date ? (
              <>
                {" "}&middot; {photo.date}
              </>
            ) : null}
          </p>
          {photo.caption ? (
            <p
              className="album-handwritten mt-0.5 text-[8.5px] leading-[11px] text-[#5d452f]/95"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {photo.caption}
            </p>
          ) : null}
        </div>
      </div>
    );
  }
  if (photo.style === "taped") {
    return (
      <div className="relative rounded-[2px] border border-white/30 bg-white/5 shadow-lg shadow-black/40">
        <img
          src={photo.image}
          alt={photo.alt}
          loading="lazy"
          className="aspect-[4/3.2] w-full object-cover object-center saturate-[0.72]"
        />
        <div className="album-tape absolute -top-2.5 left-3 h-4 w-12 -rotate-6" />
        <div className="album-tape absolute -top-2.5 right-3 h-4 w-12 rotate-6" />
      </div>
    );
  }
  return (
    <div className="rounded-[1px] border border-white/40 bg-white/10 shadow-lg shadow-black/40">
      <img
        src={photo.image}
        alt={photo.alt}
        loading="lazy"
        className="aspect-[4/5] w-full object-cover object-center saturate-[0.72]"
      />
    </div>
  );
}

function AlbumPhotoView({
  photo,
  index,
  editing,
  selected,
  entering,
  onSelect,
  onDragStart,
}: {
  photo: AlbumPhoto;
  index: number;
  editing: boolean;
  selected: boolean;
  entering: boolean;
  onSelect: (photo: AlbumPhoto) => void;
  onDragStart: (
    event: React.PointerEvent<HTMLDivElement>,
    photo: AlbumPhoto,
  ) => void;
}) {
  const stickerIndex = getStickerIndex(photo);
  const customStickerSrc = getCustomStickerSrc(photo);
  return (
    <div
      className={`group absolute ${editing ? "cursor-grab hover:z-10" : ""}`}
      style={{
        left: `${photo.x}%`,
        top: `${photo.y}%`,
        width: `${photo.width}%`,
        transform: `rotate(${photo.rotation}deg) scale(${photo.scale})`,
        willChange: "transform",
        animation: editing
          ? undefined
          : `album-photo-float 12s ease-in-out ${getPhotoDelay(index)} infinite`,
      }}
      onPointerDown={(event) => onDragStart(event, photo)}
      onClick={(event) => {
        if (!editing) return;
        // A real drag also ends with a click — ignore it so dragging a photo
        // never pops the editor open by accident.
        if (Date.now() < suppressPhotoClickUntil) return;
        event.stopPropagation();
        onSelect(photo);
      }}
    >
      <div
        className={`relative shadow-lg shadow-black/35 transition-all duration-500 group-hover:-translate-y-1.5 group-hover:scale-102 group-hover:shadow-2xl group-hover:shadow-black/55 ${
          selected ? "ring-2 ring-blush/80" : ""
        }`}
        style={{
          animation: entering
            ? "album-photo-in 0.68s cubic-bezier(0.2,0.9,0.35,1)"
            : undefined,
        }}
      >
        <div className="album-glimmer album-glimmer--on relative">
          <AlbumPhotoFrame photo={photo} />
        </div>
        {editing && (
          <button
            type="button"
            aria-label={`Edit photo: ${photo.title || "Untitled"}`}
            title="Edit this photo"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => {
              if (Date.now() < suppressPhotoClickUntil) return;
              event.stopPropagation();
              onSelect(photo);
            }}
            className="absolute -right-2 -top-2 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-blush/40 bg-ink/90 ring-1 ring-blush/70 transition-transform duration-200 hover:scale-110"
          >
            <Pencil size={12} />
          </button>
        )}
        {stickerIndex >= 0 && (
          <MemorySticker
            stickerIndex={stickerIndex}
            customStickerSrc={customStickerSrc}
            index={index}
            positionClass=""
            style={{ left: "84%", top: "82%" }}
            stickerScale={0.72}
          />
        )}
      </div>
      {photo.style !== "polaroid" && (
        <div className="mt-1 text-center opacity-80 transition-opacity duration-400 group-hover:opacity-100">
          <p className="text-[8px] font-serif italic leading-[12px] text-[#6b4f3a]">
            {photo.title}
          </p>
          {photo.caption ? (
            <p
              className="mx-auto mt-1 w-[96%] text-[9px] font-serif italic leading-[13px] text-[#4d3523]"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {photo.caption}
            </p>
          ) : null}
          <p className="mt-1 text-[6.5px] uppercase tracking-[0.22em] text-[#8a7560]/80">
            {photo.date}
          </p>
        </div>
      )}
    </div>
  );
}
/* ---------- a physical paper page ---------- */

function AlbumPageView({
  page,
  side,
  editing,
  selectedPhotoId,
  onSelectPhoto,
  onDragPhotoStart,
  enteringPhotoId,
}: {
  page: AlbumPage;
  side: "left" | "right";
  editing: boolean;
  selectedPhotoId: string | null;
  onSelectPhoto: (photo: AlbumPhoto) => void;
  onDragPhotoStart: (
    event: React.PointerEvent<HTMLDivElement>,
    photo: AlbumPhoto,
  ) => void;
  enteringPhotoId: string | null;
}) {
  const pageNo =
    page.pageNumber < 10 ? `0${page.pageNumber}` : String(page.pageNumber);
  // This view fills whatever wrapper it is placed in: the static half-book
  // wrappers, or the half-book turning leaf. The wrapper decides the side —
  // this view must NOT shrink itself again or the page becomes a quarter of
  // the book and its photos stop lining up with taps.
  return (
    <div className="album-flip-form absolute inset-0">
      <div className="absolute inset-0 overflow-hidden rounded-[6px]">
        <div
          className={`absolute inset-0 ${
            page.kind === "endpaper" ? "album-endpaper" : "album-paper"
          }`}
        />
        <div className="paper-texture absolute inset-0 opacity-70" />
        <div
          className={`pointer-events-none absolute inset-0 ${
            side === "left"
              ? "album-page-spine-left"
              : "album-page-spine-right"
          }`}
        />
        {page.kind === "endpaper" ? (
          <EndpaperContent page={page} />
        ) : (
          <>
            {page.accent ? <AccentGlyph accent={page.accent} side={side} /> : null}
            {page.photos.map((photo, index) => (
              <AlbumPhotoView
                key={photo.id}
                photo={photo}
                index={index}
                editing={editing}
                selected={selectedPhotoId === photo.id}
                entering={photo.id === enteringPhotoId}
                onSelect={onSelectPhoto}
                onDragStart={onDragPhotoStart}
              />
            ))}
            {page.note ? <AlbumNote text={page.note} side={side} /> : null}
          </>
        )}
        {page.kind !== "endpaper" && (
          <span
            className={`pointer-events-none absolute bottom-2.5 ${
              side === "left" ? "left-3" : "right-3"
            } text-[8px] uppercase tracking-[0.34em] text-[#8a7560]/65`}
          >
            {pageNo}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- the closed book (cover) ---------- */

export function AlbumClosedBook({
  className = "",
  showTitle = true,
}: {
  className?: string;
  showTitle?: boolean;
}) {
  return (
    <div
      className={`album-cover-leather album-gold-frame relative h-full w-full overflow-hidden rounded-[10px] ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-2/3 bg-gradient-to-r from-transparent to-[#ffdca8]/[0.06]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, rgba(255,246,224,0.12), transparent 42%, rgba(255,236,200,0.05))",
            animation: "album-cover-sheen 7s ease-in-out infinite",
          }}
        />
      </div>

      {/* book spine — a darker bound edge with raised gold ribs */}
      <div className="album-book-spine pointer-events-none absolute inset-y-0 left-0 w-[6.5%]">
        {[16, 36, 64, 84].map((top) => (
          <span
            key={top}
            className="absolute left-1/2 h-px w-[72%] -translate-x-1/2 bg-[#d6b886]/35"
            style={{ top: `${top}%` }}
          />
        ))}
      </div>

      {/* faint hinge where the cover meets the spine */}
      <div className="pointer-events-none absolute inset-y-0 left-[8.5%] w-px bg-[#caaa6e]/20" />

      {/* layered page edges on the right */}
      <div className="album-page-edges pointer-events-none absolute bottom-[1.4%] right-[1.4%] top-[1.4%] w-[2.2%] rounded-r-[4px]" />

      {/* gentle warm highlights along the edges */}
      <div className="pointer-events-none absolute inset-x-[6.5%] top-0 h-px bg-gradient-to-r from-transparent via-[#ffe9c4]/30 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-[6.5%] w-px bg-gradient-to-b from-transparent via-[#ffe9c4]/15 to-transparent" />

      {showTitle && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="h-px w-16 bg-gradient-to-r from-transparent via-[#caaa6e]/70 to-transparent" />
          <p className="font-serif text-xl italic tracking-[0.04em] text-[#e6cfa2] sm:text-2xl">
            A Little Album
          </p>
          <span className="rotate-45 text-[13px] text-[#d8b77e]">
            &#10086;
          </span>
          <p className="font-serif text-[8px] uppercase tracking-[0.4em] text-[#c9a878]/90">
            Made by Amorth
          </p>
          <span className="h-px w-10 bg-gradient-to-r from-transparent via-[#caaa6e]/50 to-transparent" />
        </div>
      )}
    </div>
  );
}
/* ---------- the opening cover leaf (rotates -120deg -> 0deg) ---------- */

function CoverLeaf({ page }: { page: AlbumPage }) {
  return (
    <motion.div
      initial={{ rotateY: -120, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        rotateY: { duration: 1.5, ease: [0.25, 0.85, 0.4, 1] },
        opacity: { duration: 0.35 },
      }}
      style={{
        transformStyle: "preserve-3d",
        transformOrigin: "right center",
      }}
      className="absolute inset-y-0 left-0 w-1/2"
    >
      <div className="album-flip-face absolute inset-0 rounded-[6px]">
        <div className="album-endpaper absolute inset-0 overflow-hidden rounded-[6px]">
          <EndpaperContent page={page} />
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- a turning page (front + back) ---------- */

function FlipLeaf({
  dir,
  progress,
  animating,
  front,
  back,
}: {
  dir: 1 | -1;
  progress: number;
  animating: boolean;
  front: AlbumPage;
  back: AlbumPage;
}) {
  const noop = () => {};
  return (
    <div
      className="album-flip-form absolute inset-y-0"
      style={{
        width: "50%",
        left: dir === 1 ? "50%" : "0",
        transformStyle: "preserve-3d",
        transformOrigin: dir === 1 ? "left center" : "right center",
        transform: `rotateY(${
          dir === 1 ? -progress * 180 : progress * 180
        }deg)`,
        transition: animating
          ? `transform ${flipTime}s cubic-bezier(0.35,0.75,0.3,1)`
          : "none",
        zIndex: 40,
      }}
    >
      <div className="album-flip-face absolute inset-0 rounded-[6px]">
        <AlbumPageView
          page={front}
          side={dir === 1 ? "right" : "left"}
          editing={false}
          selectedPhotoId={null}
          onSelectPhoto={noop}
          onDragPhotoStart={noop}
          enteringPhotoId={null}
        />
      </div>
      <div
        className="album-flip-face absolute inset-0"
        style={{ transform: "rotateY(180deg)", borderRadius: "6px" }}
      >
        <div className="h-full w-full" style={{ transform: "scaleX(-1)" }}>
          <AlbumPageView
            page={back}
            side={dir === 1 ? "left" : "right"}
            editing={false}
            selectedPhotoId={null}
            onSelectPhoto={noop}
            onDragPhotoStart={noop}
            enteringPhotoId={null}
          />
        </div>
      </div>
    </div>
  );
}
/* ---------- shared sticker picker for the album modals ---------- */

function AlbumStickerPicker({
  value,
  onChange,
}: {
  value: { index: number; src?: string };
  onChange: (selection: { index: number; src?: string }) => void;
}) {
  const [customStickers, setCustomStickers] = useState<CustomSticker[]>(() =>
    sanitizeStickers(readCustomStickers()),
  );
  const [uploadingSticker, setUploadingSticker] = useState(false);
  const [stickerError, setStickerError] = useState<string | null>(null);
  // Uploads can finish other pickers' reads — refresh the row whenever the
  // shared sticker list changes anywhere (add-photo, edit-photo, gallery).
  useEffect(() => {
    const refresh = () => setCustomStickers(sanitizeStickers(readCustomStickers()));
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("birthday-stickers-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("birthday-stickers-changed", refresh);
    };
  }, []);
  const stickerFileRef = useRef<HTMLInputElement | null>(null);

  async function handleStickerFiles(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setUploadingSticker(true);
    setStickerError(null);
    try {
      const fresh: CustomSticker[] = [];
      let skipped = 0;
      for (const file of Array.from(files)) {
        if (!isImageFile(file)) {
          skipped += 1;
          continue;
        }
        try {
          const sticker = await uploadSticker(file);
          fresh.push(sticker);
        } catch {
          skipped += 1;
        }
      }
      if (fresh.length > 0) {
        // One write keeps storage order identical to the list on screen, so
        // the uploaded sticker she taps is the one that gets selected.
        // The shared-storage event also refreshes this list — merge instead of
        // blindly prepending so a double event can never duplicate the row.
        const saved = saveCustomStickers(fresh);
        setCustomStickers((current) => {
          const known = new Set(current.map((sticker) => sticker.id));
          return [...fresh.filter((sticker) => !known.has(sticker.id)), ...current];
        });
        if (!saved) {
          setStickerError(
            "Storage is full — your sticker is selected for this photo, but remove a few photos so it stays saved.",
          );
        }
        // New uploads are prepended, so the first one sits right after the built-ins.
        onChange({ index: stickerDesigns.length, src: fresh[0].src });
      }
      if (skipped > 0 && fresh.length === 0) {
        setStickerError("That file was not an image — pick a photo instead.");
      }
    } finally {
      setUploadingSticker(false);
      event.target.value = "";
    }
  }
  return (
    <div>
      <p className="mb-2 text-[9px] uppercase tracking-[0.22em] text-sand/55">
        Sticker
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ index: -1 })}
          className={`flex h-9 w-9 items-center justify-center rounded-full border text-[10px] transition-all duration-300 ${
            value.index === -1 && !value.src
              ? "border-blush bg-blush/20 text-blush"
              : "border-white/15 text-sand/50 hover:border-white/40"
          }`}
          aria-label="No sticker"
        >
          <X size={11} />
        </button>
        {stickerDesigns.map((Sticker, i) => (
          <button
            key={`album-sticker-${i}`}
            type="button"
            onClick={() => onChange({ index: i, src: undefined })}
            className={`h-10 w-10 rounded-full border-2 p-1 transition-all duration-300 ${
              value.index === i && !value.src
                ? "border-blush bg-blush/20 scale-110"
                : "border-white/15 bg-ivory/95 hover:border-white/50"
            }`}
            aria-label={`Sticker ${i + 1}`}
          >
            <Sticker />
          </button>
        ))}
        {customStickers.map((sticker, i) => {
          const absoluteIndex = stickerDesigns.length + i;
          // The image is the identity: highlight whichever button shows the
          // chosen image, regardless of list order. Older saves that stored
          // only an index (no image) still match by index. Each button writes
          // its own image back, so the tap always selects exactly what she
          // tapped — never a neighbour.
          const selected = value.src
            ? value.src === sticker.src
            : value.index === absoluteIndex;
          return (
            <button
              key={sticker.id}
              type="button"
              onClick={() => {
                // Refresh against storage in-place — never blank the row.
                const saved = sanitizeStickers(readCustomStickers());
                const at = saved.findIndex(
                  (entry) => entry.src === sticker.src,
                );
                onChange({
                  index: at >= 0 ? stickerDesigns.length + at : absoluteIndex,
                  src: sticker.src,
                });
              }}
              className={`h-10 w-10 rounded-full border-2 p-0.5 transition-all duration-300 ${
                selected
                  ? "border-blush bg-blush/20 scale-110"
                  : "border-white/15 bg-ivory/95 hover:border-white/50"
              }`}
              aria-label={`Custom sticker ${i + 1}`}
              title="Use this uploaded sticker"
            >
              <img
                src={sticker.src}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => stickerFileRef.current?.click()}
          disabled={uploadingSticker}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-white/25 text-sand/50 transition-all duration-300 hover:border-blush hover:text-blush disabled:opacity-60"
          aria-label="Upload your own sticker image"
          title="Upload your own sticker image"
        >
          <ImagePlus size={14} />
        </button>
        <input
          ref={stickerFileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => void handleStickerFiles(event)}
        />
        {uploadingSticker && (
          <p className="w-full text-[10px] text-sand/60">
            Adding your sticker…
          </p>
        )}
        {stickerError && (
          <p className="w-full text-[10px] text-blush">{stickerError}</p>
        )}
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-[9px] uppercase tracking-[0.18em] text-sand/55">
      <span className="w-16 shrink-0">{label}</span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 w-full accent-[#d19b8b]"
      />
    </label>
  );
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[9px] uppercase tracking-[0.22em] text-sand/55">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border-b border-white/20 bg-transparent px-0 py-1.5 text-sm text-ivory outline-none transition-colors focus:border-blush"
      />
    </label>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}
/* ---------- edit a single photo ---------- */

function PhotoEditorModal({
  photo,
  onSave,
  onRemove,
  onCancel,
}: {
  photo: AlbumPhoto;
  onSave: (photo: AlbumPhoto) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(photo.title);
  const [date, setDate] = useState(photo.date);
  const [caption, setCaption] = useState(photo.caption);
  const [rotation, setRotation] = useState(photo.rotation);
  const [scale, setScale] = useState(photo.scale);
  const [width, setWidth] = useState(photo.width);
  const [stickerIndex, setStickerIndex] = useState(() => {
    // A custom (uploaded) sticker is identified by its image — the stored
    // index may be stale if the sticker list order shifted, so resolve it
    // against the current list by source. Sanitized: entries with an empty
    // src can never match, so a dangling image can never highlight (or save
    // back) the wrong uploaded sticker.
    if (photo.customStickerSrc) {
      const at = sanitizeStickers(readCustomStickers()).findIndex(
        (sticker) => sticker.src === photo.customStickerSrc,
      );
      return at >= 0 ? stickerDesigns.length + at : stickerDesigns.length;
    }
    return photo.stickerIndex ?? -1;
  });
  const [customStickerSrc, setCustomStickerSrc] = useState<string | undefined>(
    photo.customStickerSrc,
  );
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.4, ease }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-[#241b18] p-6 shadow-2xl shadow-black/60"
      >
        <p className="font-serif text-xl italic text-ivory">Edit this memory</p>
        <p className="mt-1 text-[10px] text-sand/50">
          Drag it on the page to move it around.
        </p>
        <div className="mt-5 space-y-4">
          <FieldInput label="Title" value={title} onChange={setTitle} />
          <FieldInput label="Description" value={date} onChange={setDate} />
          <label className="block">
            <span className="mb-1.5 block text-[9px] uppercase tracking-[0.22em] text-sand/55">
              Caption
            </span>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={2}
              className="w-full resize-none border-b border-white/20 bg-transparent px-0 py-1.5 text-sm text-ivory outline-none transition-colors focus:border-blush"
            />
          </label>
          <SliderRow
            label="Tilt"
            value={rotation}
            min={-14}
            max={14}
            step={0.5}
            onChange={setRotation}
          />
          <SliderRow
            label="Size"
            value={width}
            min={30}
            max={88}
            step={2}
            onChange={setWidth}
          />
          <SliderRow
            label="Scale"
            value={scale}
            min={0.6}
            max={1.4}
            step={0.05}
            onChange={setScale}
          />
          <AlbumStickerPicker
            value={{ index: stickerIndex, src: customStickerSrc }}
            onChange={(selection) => {
              setStickerIndex(selection.index);
              setCustomStickerSrc(selection.src);
            }}
          />
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={onRemove}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-[10px] uppercase tracking-[0.2em] text-blush transition-all duration-300 hover:border-blush/60 hover:scale-[1.03]"
            >
              <Trash2 size={13} /> Remove
            </button>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="rounded-full border border-white/20 px-4 py-2.5 text-[10px] uppercase tracking-[0.2em] text-sand transition-all duration-300 hover:border-white hover:scale-[1.03]"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  onSave({
                    ...photo,
                    title,
                    date,
                    caption,
                    rotation,
                    scale,
                    width,
                    stickerIndex: stickerIndex === -1 ? undefined : stickerIndex,
                    customStickerSrc:
                      stickerIndex === -1 ? undefined : customStickerSrc,
                  })
                }
                className="inline-flex items-center gap-2 rounded-full bg-ivory px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-ink transition-all duration-300 hover:bg-blush hover:scale-[1.03]"
              >
                <Check size={13} /> Save
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
/* ---------- add a new memory to the album ---------- */

function AddPhotoModal({
  onAdd,
  onCancel,
}: {
  onAdd: (photo: AlbumPhoto) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [caption, setCaption] = useState("");
  const [stickerIndex, setStickerIndex] = useState(-1);
  const [customStickerSrc, setCustomStickerSrc] = useState<string | undefined>(
    undefined,
  );
  const [saving, setSaving] = useState(false);

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>): void {
    const chosen = event.target.files?.[0];
    if (!chosen || !chosen.type.startsWith("image/")) return;
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
    event.target.value = "";
  }

  async function handleAdd(): Promise<void> {
    if (!file || saving) return;
    setSaving(true);
    try {
      const src = await readFileAsDataUrl(file);
      const finalTitle = title.trim() || "A new memory";
      const finalDate = date.trim() || "Just now";
      const finalCaption = caption.trim() || "A moment worth keeping.";
      // One unique id per added photo — timestamps alone can collide and two
      // photos sharing an id would fight over the same edit/remove target.
      const uploadId = nextAlbumId("album-upload");
      const photoId = nextAlbumId("album-photo");
      // Album-only storage: this photo will never appear in the memories gallery.
      // "No sticker" stays sticker-free everywhere: undefined index + no
      // image. (The old `0` here painted the first anime sticker in the
      // memories gallery even when she picked none.)
      saveAlbumUpload({
        id: uploadId,
        src,
        alt: finalTitle,
        title: finalTitle,
        date: finalDate,
        caption: finalCaption,
        layout: "square",
        stickerIndex: stickerIndex === -1 ? undefined : stickerIndex,
        customStickerSrc:
          stickerIndex === -1 ? undefined : customStickerSrc,
      } as Parameters<typeof saveAlbumUpload>[0]);
      onAdd({
        id: photoId,
        image: src,
        alt: finalTitle,
        title: finalTitle,
        date: finalDate,
        caption: finalCaption,
        style: "polaroid",
        x: 28,
        y: 14,
        rotation: Math.round((Math.random() * 6 - 3) * 10) / 10,
        scale: 1,
        width: 44,
        stickerIndex: stickerIndex === -1 ? undefined : stickerIndex,
        customStickerSrc:
          stickerIndex === -1 ? undefined : customStickerSrc,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.4, ease }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#241b18] p-6 shadow-2xl shadow-black/60"
      >
        <p className="font-serif text-xl italic text-ivory">Add to the album</p>
        <p className="mt-1 text-[10px] text-sand/50">
          A photograph, a few words, and it becomes part of the book.
        </p>
        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="mb-2 block text-[9px] uppercase tracking-[0.22em] text-sand/55">
              Photograph
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={chooseFile}
              className="block w-full text-xs text-sand/60 file-input file:text-sand/60"
            />
            {preview ? (
              <div className="mt-3 flex justify-center">
                <div className="rounded-[2px] bg-[#f4edda] p-2.5 shadow-xl shadow-black/50">
                  <img
                    src={preview}
                    alt="Preview"
                    className="h-36 w-auto max-w-[220px] rounded-[1px] object-contain"
                  />
                  <p className="mt-1 font-serif text-[9px] italic text-[#5d452f]">
                    {title || "A new memory"} &middot; {date || "Just now"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex h-24 items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.02] text-[10px] uppercase tracking-[0.2em] text-sand/50">
                Choose a photo to preview it here
              </div>
            )}
          </label>
          <FieldInput label="Title" value={title} onChange={setTitle} />
          <FieldInput label="Date" value={date} onChange={setDate} />
          <label className="block">
            <span className="mb-1.5 block text-[9px] uppercase tracking-[0.22em] text-sand/55">
              Short caption
            </span>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={2}
              className="w-full resize-none border-b border-white/20 bg-transparent px-0 py-1.5 text-sm text-ivory outline-none transition-colors focus:border-blush"
            />
          </label>
          <AlbumStickerPicker
            value={{ index: stickerIndex, src: customStickerSrc }}
            onChange={(selection) => {
              setStickerIndex(selection.index);
              setCustomStickerSrc(selection.src);
            }}
          />
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={onCancel}
              className="rounded-full border border-white/20 px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-sand transition-all duration-300 hover:border-white hover:scale-[1.03]"
            >
              Cancel
            </button>
            <button
              disabled={!file || saving}
              onClick={() => void handleAdd()}
              className="inline-flex items-center gap-2 rounded-full bg-ivory px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-ink transition-all duration-300 hover:bg-blush hover:scale-[1.03] disabled:opacity-60"
            >
              {saving ? "Placing…" : "Place in album"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
/* ---------- helpers for the overlay ---------- */

let albumIdCounter = 0;

/** Unique id generator — timestamps alone can collide; this never does. */
function nextAlbumId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++albumIdCounter}`;
}

/**
 * Photos hidden behind the page note or stuck out of bounds feel broken
 * (visible but impossible to tap). Keep every photo inside a tappable area
 * so any photo can always be selected, edited, and removed.
 */
function normalizeAlbumPhoto(photo: AlbumPhoto): AlbumPhoto {
  const normalized: AlbumPhoto = {
    id: photo.id && photo.id.length > 0 ? photo.id : nextAlbumId("album-photo"),
    image: photo.image || "",
    alt: photo.alt || "",
    title: photo.title || "",
    date: photo.date || "",
    caption: photo.caption || "",
    style:
      photo.style === "polaroid" ||
      photo.style === "print" ||
      photo.style === "taped"
        ? photo.style
        : "print",
    // Leave a clear strip at the page bottom for the handwritten note card,
    // and keep photos inside the page so they are always tappable.
    x:
      typeof photo.x === "number" && Number.isFinite(photo.x)
        ? clamp(Math.round(photo.x * 10) / 10, 2, 50)
        : 20,
    y:
      typeof photo.y === "number" && Number.isFinite(photo.y)
        ? clamp(Math.round(photo.y * 10) / 10, 2, 52)
        : 14,
    rotation:
      typeof photo.rotation === "number" && Number.isFinite(photo.rotation)
        ? photo.rotation
        : 0,
    scale:
      typeof photo.scale === "number" && Number.isFinite(photo.scale)
        ? photo.scale
        : 1,
    width:
      typeof photo.width === "number" && Number.isFinite(photo.width)
        ? clamp(Math.round(photo.width), 20, 88)
        : 44,
  };
  if (typeof photo.stickerIndex === "number" && photo.stickerIndex >= 0) {
    normalized.stickerIndex = photo.stickerIndex;
  }
  if (
    typeof photo.customStickerSrc === "string" &&
    photo.customStickerSrc.length > 0
  ) {
    normalized.customStickerSrc = photo.customStickerSrc;
  }
  return normalized;
}

/**
 * Older builds could save two photos under the same id (or photos with missing
 * fields). A shared id made edit/remove affect the wrong photo, and missing
 * fields could leave a photo unclickable. Make every id unique and every photo
 * complete so any photo can be selected, edited, and removed.
 */
function normalizeAlbumSpreads(spreads: AlbumSpread[]): AlbumSpread[] {
  const usedIds = new Set<string>();
  const fix = (raw: AlbumPhoto): AlbumPhoto => {
    const photo = normalizeAlbumPhoto(raw);
    if (usedIds.has(photo.id)) {
      photo.id = nextAlbumId("album-photo");
    }
    usedIds.add(photo.id);
    return photo;
  };
  const fixPage = (page: AlbumPage): AlbumPage => {
    const photos = page.photos.map(fix);
    // A photo that ended up on an endpaper would be invisible — endpapers only
    // paint a note. Turn such a page back into a real page so every photo on
    // it can be seen, tapped, edited, and removed.
    if (page.kind === "endpaper" && photos.length > 0) {
      const { kind, ...rest } = page;
      return { ...rest, photos };
    }
    return { ...page, photos };
  };
  return spreads.map((spread) => ({
    ...spread,
    left: fixPage(spread.left),
    right: fixPage(spread.right),
  }));
}

/** Reload the celebrant's book straight from storage (legacy cleanup too). */
function loadStoredAlbum(): AlbumSpread[] {
  resetLegacyAlbumStorage();
  migrateLeakedAlbumUploads();
  const base = normalizeAlbumSpreads(readAlbumSpreads() ?? buildInitialAlbum());
  return ensureAlbumUploadsPresent(base);
}

/**
 * Guarantee every uploaded album photo appears in the book exactly once.
 * If a photo was uploaded but never got placed on a saved page (for example a
 * save was interrupted), give it a fresh page right away — otherwise it would
 * sit invisible in storage, uneditable and unremovable.
 */
function ensureAlbumUploadsPresent(spreads: AlbumSpread[]): AlbumSpread[] {
  const uploads = readAlbumUploads();
  if (uploads.length === 0) return spreads;
  const placed = new Set<string>();
  for (const spread of spreads) {
    for (const photo of spread.left.photos) placed.add(photo.image);
    for (const photo of spread.right.photos) placed.add(photo.image);
  }
  const missing = uploads.filter((upload) => !placed.has(upload.src));
  if (missing.length === 0) return spreads;
  let next = spreads;
  for (const upload of missing) {
    const photo: AlbumPhoto = {
      id: nextAlbumId("album-photo"),
      image: upload.src,
      alt: upload.alt || "",
      title: upload.title || "",
      date: upload.date || "",
      caption: upload.caption || "",
      style: "polaroid",
      x: 8,
      y: 6,
      width: 84,
      rotation: Math.round((Math.random() * 2 - 1) * 10) / 10,
      scale: 1,
      stickerIndex: upload.stickerIndex,
      customStickerSrc: upload.customStickerSrc,
    };
    next = [
      ...next,
      {
        id: nextAlbumId("album-spread"),
        left: {
          id: nextAlbumId("album-page"),
          pageNumber: 0,
          accent: "star",
          photos: [photo],
        },
        right: {
          id: nextAlbumId("album-page"),
          pageNumber: 0,
          accent: "quote",
          note: "A quiet page, all its own.",
          photos: [],
        },
      },
    ];
  }
  return normalizePageNumbers(next);
}

function findPhotoPage(
  spreads: AlbumSpread[],
  photoId: string,
): { spread: number; side: "left" | "right" } | null {
  for (let s = 0; s < spreads.length; s += 1) {
    if (spreads[s].left.photos.some((p) => p.id === photoId)) {
      return { spread: s, side: "left" };
    }
    if (spreads[s].right.photos.some((p) => p.id === photoId)) {
      return { spread: s, side: "right" };
    }
  }
  return null;
}

function findAlbumPhotoById(
  spreads: AlbumSpread[],
  photoId: string,
): AlbumPhoto | null {
  for (const spread of spreads) {
    for (const photo of spread.left.photos) {
      if (photo.id === photoId) return photo;
    }
    for (const photo of spread.right.photos) {
      if (photo.id === photoId) return photo;
    }
  }
  return null;
}

function normalizePageNumbers(spreads: AlbumSpread[]): AlbumSpread[] {
  return spreads.map((spread, s) => ({
    ...spread,
    left: { ...spread.left, pageNumber: s * 2 + 1 },
    right: { ...spread.right, pageNumber: s * 2 + 2 },
  }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type FlipState = {
  dir: 1 | -1;
  progress: number;
  animating: boolean;
  front: AlbumPage;
  back: AlbumPage;
};

type DragTrack = {
  x0: number;
  y0: number;
  zone: -1 | 0 | 1;
  active: boolean;
};

/* ---------- the full-screen book experience ---------- */

function AlbumOverlay({
  spreads: initialSpreads,
  onExited,
  canEdit,
  onAlbumSaved,
}: {
  spreads: AlbumSpread[];
  onExited: () => void;
  canEdit: boolean;
  onAlbumSaved?: (spreads: AlbumSpread[]) => void;
}) {
  /* When the celebrant opens the book, always start from the latest saved
     pages — otherwise photos added on an earlier visit would be invisible
     (and therefore could not be edited or removed). Visitors keep the
     curated book passed down by the section. */
  const [spreads, setSpreads] = useState<AlbumSpread[]>(() =>
    canEdit ? loadStoredAlbum() : initialSpreads,
  );
  const [phase, setPhase] = useState<
    "closed" | "opening" | "reading" | "closing"
  >("closed");
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [flip, setFlip] = useState<FlipState | null>(null);
  const [fading, setFading] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AlbumSpread[] | null>(null);
  const [editPhoto, setEditPhoto] = useState<AlbumPhoto | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [enteringPhotoId, setEnteringPhotoId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState(true);
  /* Shared-cloud album status — checked when the book mounts so a silently
     off sync (missing Blob token) is visible in Edit mode, never hidden. */
  const [cloudSync, setCloudSync] = useState<CloudSyncStatus | null>(null);

  const reduceMotion = useReducedMotion();
  const bookRef = useRef<HTMLDivElement>(null);
  const leftWrapRef = useRef<HTMLDivElement>(null);
  const rightWrapRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<FlipState | null>(null);
  const dragRef = useRef<DragTrack | null>(null);
  const photoDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    side: "left" | "right";
  } | null>(null);
  const timerIds = useRef<number[]>([]);

  /* Latest draft, readable from async callbacks without re-running them. */
  const draftRef = useRef<AlbumSpread[] | null>(null);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  /* Cross-device sync: when the celebrant opens the book, check the shared
     cloud copy first. If another device (laptop, phone…) saved a newer book,
     adopt it here — that is what makes photos added on one device visible on
     every other one. If she is mid-edit, her session wins. */
  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    void pullCloudAlbum().then(async (cloud) => {
      if (cancelled) return;
      const status: CloudSyncStatus = cloud
        ? { on: true }
        : await checkCloudSync();
      if (cancelled) return;
      setCloudSync(status);
      if (cloud && !draftRef.current) setSpreads(loadStoredAlbum());
    });
    return () => {
      cancelled = true;
    };
  }, [canEdit]);

  /** One path for every album save: device storage + cloud mirror. */
  function persistAlbum(next: AlbumSpread[]): void {
    saveAlbumSpreads(next);
    noteLocalAlbumSave();
    pruneAlbumUploads(next);
    onAlbumSaved?.(next);
    void pushCloudAlbum(next);
  }

  useEffect(() => {
    flipRef.current = flip;
  }, [flip]);

  useEffect(() => {
    if (musicOn) {
      startAlbumMusic();
    } else {
      stopAlbumMusic();
    }
    return () => stopAlbumMusic();
  }, [musicOn]);

  useEffect(() => {
    setOnMusicEnded(() => setMusicOn(false));
    return () => setOnMusicEnded(null);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (phase === "closed") {
      timerIds.current.push(
        window.setTimeout(() => setPhase("opening"), 1500),
      );
    } else if (phase === "opening") {
      timerIds.current.push(
        window.setTimeout(() => {
          setPhase("reading");
        }, 2250),
      );
    } else if (phase === "closing") {
      timerIds.current.push(window.setTimeout(() => onExited(), 1650));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (!hintVisible) return;
    const timer = window.setTimeout(() => setHintVisible(false), 6000);
    timerIds.current.push(timer);
    return () => window.clearTimeout(timer);
  }, [hintVisible]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2400);
    timerIds.current.push(timer);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    const cleanup = () => {
      timerIds.current.forEach((id) => window.clearTimeout(id));
      timerIds.current = [];
    };
    return cleanup;
  }, []);

  const activeSpreads = draft ?? spreads;
  const currentSpread =
    activeSpreads[Math.min(spreadIndex, activeSpreads.length - 1)];
  const totalPages = activeSpreads.length * 2;
  const leftPageNum = currentSpread.left.pageNumber;
  const rightPageNum = currentSpread.right.pageNumber;
  const leftPage =
    flip && flip.dir === -1
      ? activeSpreads[spreadIndex - 1].left
      : currentSpread.left;
  const rightPage =
    flip && flip.dir === 1
      ? activeSpreads[spreadIndex + 1].right
      : currentSpread.right;
/* ---- flip engine ---- */

  function commitFlip(dir: 1 | -1): void {
    const target = clamp(
      spreadIndex + dir,
      0,
      activeSpreads.length - 1,
    );
    setSpreadIndex(target);
    setFlip(null);
  }

  function startFlip(dir: 1 | -1): boolean {
    if (phase !== "reading" || flipRef.current) return false;
    const target = spreadIndex + dir;
    if (target < 0 || target >= activeSpreads.length) return false;
    if (reduceMotion) {
      setFading(true);
      timerIds.current.push(
        window.setTimeout(() => {
          setSpreadIndex(target);
          timerIds.current.push(
            window.setTimeout(() => setFading(false), 240),
          );
        }, 260),
      );
      return true;
    }
    const front =
      dir === 1
        ? activeSpreads[spreadIndex].right
        : activeSpreads[spreadIndex].left;
    const back =
      dir === 1
        ? activeSpreads[target].left
        : activeSpreads[target].right;
    setFlip({ dir, progress: 0, animating: true, front, back });
    timerIds.current.push(
      window.setTimeout(() => {
        setFlip((f) => (f ? { ...f, progress: 1, animating: true } : f));
      }, 50),
    );
    timerIds.current.push(
      window.setTimeout(() => commitFlip(dir), flipMs),
    );
    return true;
  }

  function startFlipFromDrag(dir: 1 | -1): void {
    if (phase !== "reading" || flipRef.current) return;
    const target = spreadIndex + dir;
    if (target < 0 || target >= activeSpreads.length) return;
    setFlip({
      dir,
      progress: 0,
      animating: false,
      front:
        dir === 1
          ? activeSpreads[spreadIndex].right
          : activeSpreads[spreadIndex].left,
      back:
        dir === 1
          ? activeSpreads[target].left
          : activeSpreads[target].right,
    });
  }

  function finishFlipAfterDrag(commit: boolean, dir: 1 | -1): void {
    if (commit) {
      setFlip((f) => (f ? { ...f, progress: 1, animating: true } : f));
      timerIds.current.push(
        window.setTimeout(() => commitFlip(dir), 620),
      );
    } else {
      setFlip((f) => (f ? { ...f, progress: 0, animating: true } : f));
      timerIds.current.push(
        window.setTimeout(() => setFlip(null), 440),
      );
    }
  }

  /* ---- book pointer interactions (click edges, drag-turn, swipe) ---- */

  function handleBookPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (phase !== "reading" || flipRef.current || editing || reduceMotion) {
      dragRef.current = null;
      return;
    }
    const rect = bookRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left;
    const zone: -1 | 0 | 1 =
      x < rect.width * 0.3 ? -1 : x > rect.width * 0.7 ? 1 : 0;
    dragRef.current = {
      x0: event.clientX,
      y0: event.clientY,
      zone,
      active: false,
    };
  }

  function handleBookPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const track = dragRef.current;
    if (!track || flipRef.current || phase !== "reading" || editing) return;
    const dx = event.clientX - track.x0;
    const dy = event.clientY - track.y0;
    if (!track.active) {
      if (Math.abs(dx) < 28 || Math.abs(dx) < Math.abs(dy)) return;
      const swipeDir: 1 | -1 = dx < 0 ? 1 : -1;
      if (track.zone === 1 && swipeDir === 1) return;
      if (track.zone === -1 && swipeDir === -1) return;
      dragRef.current = { ...track, active: true };
      startFlipFromDrag(swipeDir);
      return;
    }
    const progress = clamp(
      Math.abs(event.clientX - track.x0) / 175,
      0,
      1,
    );
    setFlip((f) => (f ? { ...f, progress } : f));
  }

  function handleBookPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const track = dragRef.current;
    dragRef.current = null;
    if (!track) return;
    const flipNow = flipRef.current;
    if (track.active && flipNow) {
      finishFlipAfterDrag(flipNow.progress > 0.45, flipNow.dir);
      return;
    }
    if (
      !track.active &&
      Math.hypot(event.clientX - track.x0, event.clientY - track.y0) < 12 &&
      track.zone !== 0
    ) {
      startFlip(track.zone);
    }
  }

  function handleBookPointerCancel() {
    const track = dragRef.current;
    dragRef.current = null;
    const flipNow = flipRef.current;
    if (track?.active && flipNow) {
      finishFlipAfterDrag(false, flipNow.dir);
    }
  }
/* ---- edit mode: photo selection, dragging, mutations ---- */

  function updateDraftPhoto(
    photoId: string,
    updater: (photo: AlbumPhoto) => AlbumPhoto,
  ): void {
    setDraft((current) => {
      if (!current) return current;
      return current.map((spread) => ({
        ...spread,
        left: {
          ...spread.left,
          photos: spread.left.photos.map((p) =>
            p.id === photoId ? updater(p) : p,
          ),
        },
        right: {
          ...spread.right,
          photos: spread.right.photos.map((p) =>
            p.id === photoId ? updater(p) : p,
          ),
        },
      }));
    });
  }

  function handlePhotoSelect(photo: AlbumPhoto) {
    if (!editing) return;
    // Open the editor with the freshest copy of this photo from the current
    // book state, so the edit always targets the right photo.
    const live = findAlbumPhotoById(draft ?? spreads, photo.id) ?? photo;
    setEditPhoto(live);
  }

  function saveEditedPhoto(updated: AlbumPhoto): void {
    const base = draft ?? spreads;
    const next = normalizePageNumbers(base.map((spread) => ({
      ...spread,
      left: {
        ...spread.left,
        photos: spread.left.photos.map((photo) =>
          photo.id === updated.id ? { ...photo, ...updated } : photo,
        ),
      },
      right: {
        ...spread.right,
        photos: spread.right.photos.map((photo) =>
          photo.id === updated.id ? { ...photo, ...updated } : photo,
        ),
      },
    })));
    setDraft(next);
    setSpreads(next);
    persistAlbum(next);
    setEditPhoto(null);
    setNotice("Memory updated and saved");
  }

  function removeEditedPhoto(photoId: string): void {
    const base = draft ?? spreads;
    const next = normalizePageNumbers(base.map((spread) => ({
      ...spread,
      left: {
        ...spread.left,
        photos: spread.left.photos.filter((photo) => photo.id !== photoId),
      },
      right: {
        ...spread.right,
        photos: spread.right.photos.filter((photo) => photo.id !== photoId),
      },
    })));
    setDraft(next);
    setSpreads(next);
    persistAlbum(next);
    setEditPhoto(null);
    setNotice("Memory removed from the album");
  }

  function handlePhotoDragStart(
    event: React.PointerEvent<HTMLDivElement>,
    photo: AlbumPhoto,
  ) {
    if (!editing) return;
    // Never preventDefault on pointerdown — that can swallow the click on some
    // browsers/touch hardware and make a photo impossible to open for editing.
    // The book's own page-turn tracking is ignored while editing anyway.
    event.stopPropagation();
    const book = draft ?? spreads;
    const found = findPhotoPage(book, photo.id);
    if (!found) return;
    let moved = false;
    const drag = {
      id: photo.id,
      startX: event.clientX,
      startY: event.clientY,
      origX: photo.x,
      origY: photo.y,
      side: found.side,
    };
    photoDragRef.current = drag;
    const onMove = (moveEvent: PointerEvent) => {
      const current = photoDragRef.current;
      if (!current) return;
      const dxPct = (moveEvent.clientX - current.startX);
      const dyPct = (moveEvent.clientY - current.startY);
      if (!moved && Math.hypot(dxPct, dyPct) < 6) return;
      if (!moved) {
        // Real drag detected — start moving the photo and stop anything else.
        moved = true;
        moveEvent.preventDefault();
      }
      const layer =
        current.side === "left" ? leftWrapRef.current : rightWrapRef.current;
      const rect = layer?.getBoundingClientRect();
      if (!rect) return;
      const dx = (dxPct / rect.width) * 100;
      const dy = (dyPct / rect.height) * 100;
      updateDraftPhoto(current.id, (p) => ({
        ...p,
        x: clamp(current.origX + dx, 3, 88),
        y: clamp(current.origY + dy, 3, 88),
      }));
    };
    const onStop = () => {
      const current = photoDragRef.current;
      photoDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onStop);
      window.removeEventListener("pointercancel", onStop);
      if (!current) return;
      if (moved) {
        // A real drag just happened — swallow the click that follows it so the
        // editor doesn't open when she only meant to move the photo. Taps
        // (no movement) still fall through to the photo's own onClick.
        suppressPhotoClickUntil = Date.now() + 250;
        // The photo's new position is already applied to the draft.
      }
      // If it was a tap (not a drag), the browser follows up with a native
      // `click` on this photo, which opens the editor (see the onClick below)
      // — no need to open the modal from here, which would race the click and
      // let it land on the modal backdrop.
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onStop, { once: true });
    window.addEventListener("pointercancel", onStop, { once: true });
  }

  function handleAddPhoto(newPhoto: AlbumPhoto): void {
    // The added photo fills its very own page — big, centred, slightly tilted.
    const fillPhoto: AlbumPhoto = {
      ...newPhoto,
      x: 8,
      y: 6,
      width: 84,
      rotation: Math.round((Math.random() * 2 - 1) * 10) / 10,
      scale: 1,
    };
    setEnteringPhotoId(fillPhoto.id);
    let landedIndex = spreadIndex + 1;
    const next = ((): AlbumSpread[] => {
      const current = draft ?? spreads;
      // 1) Fill the first empty page — ahead of the current spread first, then
      //    from the beginning of the book. Photos never share a page, so every
      //    page gets filled as she adds photos.
      const findSlot = (): { index: number; side: "left" | "right" } | null => {
        const emptyAt = (index: number) => {
          if (index < 0 || index >= current.length) return null;
          if (current[index].left.photos.length === 0) {
            return { index, side: "left" as const };
          }
          if (current[index].right.photos.length === 0) {
            return { index, side: "right" as const };
          }
          return null;
        };
        for (
          let i = Math.min(spreadIndex + 1, current.length);
          i < current.length;
          i += 1
        ) {
          const found = emptyAt(i);
          if (found) return found;
        }
        for (let i = 0; i < current.length; i += 1) {
          const found = emptyAt(i);
          if (found) return found;
        }
        return null;
      };
      const slot = findSlot();
      if (slot) {
        landedIndex = slot.index;
        return current.map((spread, index) => {
          if (index !== slot.index) return spread;
          const page = slot.side === "left" ? spread.left : spread.right;
          // An empty endpaper becomes a real photo page the moment it is used.
          const { kind, ...rest } = page;
          const filledPage: AlbumPage = {
            ...rest,
            photos: [...page.photos, fillPhoto],
          };
          return slot.side === "left"
            ? { ...spread, left: filledPage }
            : { ...spread, right: filledPage };
        });
      }
      // 2) No empty page at all — open a fresh spread right after the current
      //    one. Its right page stays empty and will be filled next time.
      landedIndex = spreadIndex + 1;
      const freshSpread: AlbumSpread = {
        id: `album-spread-new-${fillPhoto.id}`,
        left: {
          id: `album-page-new-${fillPhoto.id}`,
          pageNumber: 0,
          accent: "star",
          photos: [fillPhoto],
        },
        right: {
          id: `album-page-new-r-${fillPhoto.id}`,
          pageNumber: 0,
          accent: "quote",
          note: "A quiet page, all its own.",
          photos: [],
        },
      };
      return normalizePageNumbers([
        ...current.slice(0, landedIndex),
        freshSpread,
        ...current.slice(landedIndex),
      ]);
    })();
    setDraft(next);
    setSpreads(next);
    persistAlbum(next);
    setAddOpen(false);
    // Turn to the page the photo landed on so she sees it right away.
    timerIds.current.push(
      window.setTimeout(() => {
        if (landedIndex !== spreadIndex) {
          setFading(true);
          setSpreadIndex(Math.min(landedIndex, Math.max(0, next.length - 1)));
          timerIds.current.push(
            window.setTimeout(() => setFading(false), 240),
          );
        }
      }, 160),
    );
    timerIds.current.push(
      window.setTimeout(() => setEnteringPhotoId(null), 1300),
    );
    setNotice("Photo added — it filled an empty page");
  }

  function enterEditing(): void {
    suppressPhotoClickUntil = 0;
    setDraft(structuredClone(spreads));
    setEditing(true);
    setEditPhoto(null);
    setNotice("Edit mode — tap any photo to edit or remove it");
  }

  function saveAlbum(): void {
    if (!draft) return;
    const saved = normalizePageNumbers(draft);
    setSpreads(saved);
    persistAlbum(saved);
    setDraft(null);
    setEditing(false);
    setEditPhoto(null);
    setNotice("Album saved");
  }

  function cancelEditing(): void {
    setDraft(null);
    setEditing(false);
    setEditPhoto(null);
    setNotice("Changes discarded");
  }

  function handleClose(): void {
    if (phase === "reading" || phase === "opening") {
      setMusicOn(false);
      stopAlbumMusic();
      setPhase("closing");
    }
  }
const albumStars = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: `${4 + ((i * 53) % 90)}%`,
        top: `${4 + ((i * 71) % 88)}%`,
        size: i % 5 === 0 ? "3px" : "2px",
        opacity: 0.18 + (i % 4) * 0.06,
        delay: `${-((i * 1.7) % 10)}s`,
        duration: `${4 + (i % 6)}s`,
      })),
    [],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease }}
      className="album-no-select fixed inset-0 z-[80] overflow-hidden bg-[#171009] text-ivory"
      role="dialog"
      aria-modal="true"
      aria-label="Photo album"
    >
      {/* celestial backdrop kept subtle behind the book */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {albumStars.map((star, i) => (
          <span
            key={`album-star-${i}`}
            className="night-star"
            style={
              {
                "--star-left": star.left,
                "--star-top": star.top,
                "--star-size": star.size,
                "--star-opacity": star.opacity,
                "--star-delay": star.delay,
                "--star-duration": star.duration,
              } as React.CSSProperties
            }
          />
        ))}
        <div className="night-moon absolute right-[6%] top-[5%] h-24 w-24 rounded-full opacity-35 sm:h-32 sm:w-32" />
        <div className="celestial-planet absolute -bottom-28 -left-24 h-72 w-72 opacity-45" />
        <div className="celestial-saturn absolute -bottom-10 right-[4%] h-24 w-24 opacity-35">
          <span className="celestial-saturn__rings" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#1e130c] via-transparent to-[#130d09]" />
      </div>
      <div className="album-spotlight pointer-events-none absolute inset-0" />

      {/* the book */}
      <div className="absolute inset-x-0 flex items-center justify-center px-2 pb-24 pt-[17vh] sm:pb-28 sm:pt-[13vh]">
        <div
          ref={bookRef}
          className="relative"
          style={{
            width: "min(92vw, 41rem)",
            aspectRatio: "1.5",
            perspective: "1500px",
            perspectiveOrigin: "50% 42%",
            touchAction: "pan-y",
            cursor: phase === "reading" && !editing ? "grab" : "default",
          }}
          onPointerDown={handleBookPointerDown}
          onPointerMove={handleBookPointerMove}
          onPointerUp={handleBookPointerUp}
          onPointerCancel={handleBookPointerCancel}
        >
          <motion.div
            initial={false}
            animate={{
              opacity:
                phase === "closed"
                  ? 0
                  : phase === "closing"
                    ? 0.22
                    : 1,
              scale: phase === "closed" ? 0.94 : 1,
              y: phase === "closing" ? 8 : 0,
            }}
            transition={{ duration: 0.8, ease }}
            className="absolute inset-0"
          >
            {/* warm light + floor shadow under the book */}
            <div className="pointer-events-none absolute -inset-8 rounded-[45%] bg-[#4a2c20]/35 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-9 left-1/2 h-7 w-[90%] -translate-x-1/2 rounded-[50%] bg-black/50 blur-lg" />
            <div className="pointer-events-none absolute inset-0 rounded-[10px] bg-black/20 blur-md" />

            {/* static left + right pages. Each half only takes its own side of
                the book — otherwise the right wrapper (painted last) sits on
                top of the whole book and swallows every tap meant for a
                left-page photo in edit mode. */}
            <div ref={leftWrapRef} className="absolute inset-y-0 left-0 w-1/2">
              <AlbumPageView
                page={leftPage}
                side="left"
                editing={editing}
                selectedPhotoId={editPhoto?.id ?? null}
                onSelectPhoto={handlePhotoSelect}
                onDragPhotoStart={handlePhotoDragStart}
                enteringPhotoId={enteringPhotoId}
              />
            </div>
            <div ref={rightWrapRef} className="absolute inset-y-0 left-1/2 w-1/2">
              <AlbumPageView
                page={rightPage}
                side="right"
                editing={editing}
                selectedPhotoId={editPhoto?.id ?? null}
                onSelectPhoto={handlePhotoSelect}
                onDragPhotoStart={handlePhotoDragStart}
                enteringPhotoId={enteringPhotoId}
              />
            </div>

            {/* spine rib */}
            <div className="album-rib pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded-full sm:w-[3px]" />
{/* the turning page */}
            {flip && (
              <FlipLeaf
                dir={flip.dir}
                progress={flip.progress}
                animating={flip.animating}
                front={flip.front}
                back={flip.back}
              />
            )}

            {/* opening cover leaf — rotates from -120deg to 0deg */}
            <AnimatePresence>
              {phase === "opening" && (
                <CoverLeaf key="album-cover-leaf" page={activeSpreads[0].left} />
              )}
            </AnimatePresence>

            {/* reduced-motion turn fade */}
            <div
              className={`pointer-events-none absolute inset-0 bg-[#f3e6c7]/55 transition-opacity duration-200 ${
                fading ? "opacity-100" : "opacity-0"
              }`}
            />
          </motion.div>

          {/* the closed cover that appears/scales in first */}
          <AnimatePresence>
            {phase === "closed" && (
              <motion.div
                key="album-closed"
                exit={{ opacity: 0, scale: 1.07, y: -10 }}
                transition={{ duration: 0.75, ease }}
                className="absolute inset-0 cursor-pointer"
                onClick={() => setPhase("opening")}
                aria-label="Open the album"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.55, y: 22 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 1.15, ease }}
                  className="h-full w-full"
                >
                  <AlbumClosedBook />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
{/* top controls */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{
          opacity: phase === "reading" ? 1 : 0,
          y: phase === "reading" ? 0 : -10,
        }}
        transition={{ duration: 0.8, ease }}
        className="absolute inset-x-0 top-0 z-50 px-4 pt-4 sm:px-8"
      >
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleClose}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-[10px] uppercase tracking-[0.2em] text-sand/90 transition-all duration-300 hover:border-white/50 hover:text-ivory hover:scale-[1.03]"
          >
            <X size={14} /> Close album
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => {
                setMusicOn((current) => !current);
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2.5 text-[10px] uppercase tracking-[0.2em] transition-all duration-300 hover:scale-[1.03] ${
                musicOn
                  ? "border-blush/60 bg-blush/10 text-blush"
                  : "border-white/15 text-sand/80 hover:border-white/40"
              }`}
              aria-pressed={musicOn}
              aria-label="Toggle album music"
            >
              <Music size={13} className={musicOn ? "animate-pulse" : ""} />
              <span className="hidden sm:inline">Music</span>
            </button>
            {canEdit && !editing && (
              <button
                onClick={enterEditing}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-sand/90 transition-all duration-300 hover:border-blush/60 hover:text-blush hover:scale-[1.03]"
              >
                <Pencil size={13} /> Edit album
              </button>
            )}
            {canEdit && editing && (
              <>
                <button
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-sand/90 transition-all duration-300 hover:border-blush/60 hover:text-blush hover:scale-[1.03]"
                >
                  <Plus size={13} /> Add photo
                </button>
                <button
                  onClick={cancelEditing}
                  className="rounded-full border border-white/20 px-3.5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-sand transition-all duration-300 hover:border-white hover:scale-[1.03]"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAlbum}
                  className="inline-flex items-center gap-2 rounded-full bg-ivory px-4 py-2.5 text-[10px] uppercase tracking-[0.2em] text-ink transition-all duration-300 hover:bg-blush hover:scale-[1.03]"
                >
                  <Check size={13} /> Save album
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
{/* bottom controls */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{
          opacity: phase === "reading" ? 1 : 0,
          y: phase === "reading" ? 0 : 14,
        }}
        transition={{ duration: 0.8, ease, delay: 0.1 }}
        className="absolute inset-x-0 bottom-0 z-50 flex flex-col items-center gap-3 px-4 pb-5 sm:px-8"
      >
        <div className="flex items-center justify-between gap-4 rounded-full border border-white/10 bg-black/35 px-4 py-2.5 backdrop-blur-md sm:gap-8 sm:px-6">
          <button
            onClick={() => startFlip(-1)}
            disabled={spreadIndex === 0 || !!flip}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-sand transition-all duration-300 hover:text-ivory hover:scale-[1.04] disabled:opacity-40"
            aria-label="Previous page"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Previous</span>
          </button>
          <span className="text-[9px] uppercase tracking-[0.3em] text-ivory/80 tabular-nums">
            {String(leftPageNum).padStart(2, "0")} &middot;{" "}
            {String(rightPageNum).padStart(2, "0")} /{" "}
            {String(totalPages).padStart(2, "0")}
          </span>
          <button
            onClick={() => startFlip(1)}
            disabled={spreadIndex === activeSpreads.length - 1 || !!flip}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-sand transition-all duration-300 hover:text-ivory hover:scale-[1.04] disabled:opacity-40"
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ArrowRight size={15} />
          </button>
        </div>
        <AnimatePresence>
          {hintVisible && phase === "reading" && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease }}
              className="text-center text-[8px] uppercase tracking-[0.3em] text-sand/45"
            >
              Drag the page edge to turn &middot; or tap an edge
            </motion.p>
          )}
          {cloudSync && !cloudSync.on && phase === "reading" && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease }}
              className="text-center text-[8px] uppercase tracking-[0.3em] text-blush/70"
            >
              {cloudSync.reason === "not-configured"
                ? "Cloud sync is off — photos stay on this device · connect Vercel Blob storage, then redeploy"
                : "Cloud sync is unreachable — photos stay on this device for now"}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* notice */}
      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-20 left-1/2 z-[96] -translate-x-1/2 rounded-full border border-blush/30 bg-ink/90 px-5 py-3 text-xs text-blush shadow-2xl shadow-black/30 backdrop-blur-md"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      {/* modals */}
      <AnimatePresence>
        {addOpen && (
          <AddPhotoModal
            onAdd={handleAddPhoto}
            onCancel={() => setAddOpen(false)}
          />
        )}
        {editPhoto && (
          <PhotoEditorModal
            key={editPhoto.id}
            photo={editPhoto}
            onSave={saveEditedPhoto}
            onRemove={() => removeEditedPhoto(editPhoto.id)}
            onCancel={() => setEditPhoto(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
/* ---------- the album section + overlay wiring ---------- */

export default function PhotoAlbumSection({
  canEdit = false,
}: {
  canEdit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  function loadSpreads(): AlbumSpread[] {
    return loadStoredAlbum();
  }

  /* Visitors only ever see the hand-curated pages — never the celebrant's
     own photographs. The book switches the moment she unlocks (or locks). */
  const [spreads, setSpreads] = useState<AlbumSpread[]>(() =>
    canEdit ? loadSpreads() : buildCuratedAlbum(),
  );

  useEffect(() => {
    setSpreads(canEdit ? loadSpreads() : buildCuratedAlbum());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  /* subtle 3D tilt that follows the cursor (a few degrees at most) */
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const tiltSpringX = useSpring(tiltX, { stiffness: 140, damping: 18 });
  const tiltSpringY = useSpring(tiltY, { stiffness: 140, damping: 18 });

  function handleCoverTilt(event: React.MouseEvent<HTMLDivElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    tiltY.set(px * 7); // ±3.5°
    tiltX.set(-py * 8); // ±4°
  }

  function resetCoverTilt(): void {
    setHovered(false);
    tiltX.set(0);
    tiltY.set(0);
  }

  /* a few photographs that peek out from behind the pages on hover */
  const peekPhotos = birthday.memories.slice(0, 3);
  const peekPositions: { style: React.CSSProperties; rotate: number }[] = [
    { style: { left: "-9%", top: "12%" }, rotate: -7 },
    { style: { right: "-10%", top: "26%" }, rotate: 6 },
    { style: { left: "-7%", bottom: "9%" }, rotate: -4 },
  ];

  return (
    <>
      <section
        id="album"
        className="relative overflow-hidden border-t border-white/10 bg-[#1f1712] px-6 py-24 md:px-10 md:py-32 lg:px-16"
      >
        {/* celestial backdrop — whisper-quiet, always behind the content */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1, duration: 1.6, ease }}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
        >
          {/* tiny stars */}
          {[
            { left: "6%", top: "18%", size: 2, delay: "0s" },
            { left: "17%", top: "72%", size: 1, delay: "1.4s" },
            { left: "31%", top: "9%", size: 2, delay: "2.2s" },
            { left: "47%", top: "86%", size: 1, delay: "0.8s" },
            { left: "63%", top: "12%", size: 2, delay: "3s" },
            { left: "74%", top: "70%", size: 1, delay: "1.9s" },
            { left: "88%", top: "34%", size: 2, delay: "2.6s" },
            { left: "94%", top: "78%", size: 1, delay: "0.4s" },
          ].map((star, i) => (
            <span
              key={`star-${i}`}
              className="absolute rounded-full bg-ivory"
              style={{
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                opacity: 0.3,
                animation: `album-star-twinkle ${5 + (i % 4)}s ease-in-out ${star.delay} infinite`,
              }}
            />
          ))}
          {/* very subtle floating particles */}
          {[
            { left: "22%", top: "56%", delay: "0s" },
            { left: "56%", top: "22%", delay: "2s" },
            { left: "83%", top: "58%", delay: "3.4s" },
          ].map((particle, i) => (
            <span
              key={`particle-${i}`}
              className="absolute h-1 w-1 rounded-full bg-[#f4d9a8]"
              style={{
                left: particle.left,
                top: particle.top,
                opacity: 0.3,
                filter: "blur(1px)",
                animation: `album-particle-drift ${9 + i * 3}s ease-in-out ${particle.delay} infinite`,
              }}
            />
          ))}
          {/* one small distant planet near the corner */}
          <div className="absolute right-[7%] top-[9%]" style={{ opacity: 0.4 }}>
            <div
              className="h-8 w-8 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 32% 30%, #c8a678, #6d4f3a 58%, #3a2820)",
                boxShadow:
                  "inset -4px -3px 8px rgba(0,0,0,0.55), 0 0 18px rgba(214,184,134,0.18)",
              }}
            />
            <div className="absolute left-1/2 top-1/2 h-px w-14 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] rounded-full bg-[#d6b886]/30" />
          </div>
        </motion.div>

        <div className="relative z-10 mx-auto max-w-[1320px]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1, ease }}
            className="mb-10 flex flex-col justify-between gap-8 md:flex-row md:items-end"
          >
            <div>
              <p className="mb-5 text-[10px] uppercase tracking-[0.35em] text-blush">
                The keepsake
              </p>
              <h2 className="font-sans text-[clamp(3.2rem,7vw,7rem)] font-light leading-[0.88] tracking-[-0.07em]">
                Your little
                <br />
                <span className="font-serif italic text-sand">album.</span>
              </h2>
            </div>
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25, duration: 0.9, ease }}
              className="max-w-[260px] border-l border-white/20 pl-4 text-xs leading-6 text-sand/60"
            >
              A little book of old photographs, quiet moments, and memories
              worth returning to.
            </motion.p>
          </motion.div>

          {/* decorative celestial divider */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0.6 }}
            whileInView={{ opacity: 1, scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.45, duration: 1, ease }}
            aria-hidden
            className="mb-14 flex items-center justify-center gap-4"
          >
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-[#caaa6e]/40" />
            <span
              className="text-[11px] text-[#d8b77e]/70"
              style={{ animation: "album-star-pulse 9s ease-in-out infinite" }}
            >
              &#10022;
            </span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-white/10 to-[#caaa6e]/40" />
          </motion.div>

          <div className="grid items-center gap-12 lg:grid-cols-[minmax(260px,360px)_1fr] lg:gap-16">
            <motion.div
              initial={{ opacity: 0, y: 40, rotate: -2 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: 0.2, duration: 1.2, ease }}
              className="relative mx-auto w-full max-w-[280px] sm:max-w-[300px]"
              style={{ aspectRatio: "1 / 1.28" }}
            >
              <motion.div
                className="relative h-full w-full"
                style={{
                  rotateX: tiltSpringX,
                  rotateY: tiltSpringY,
                  transformPerspective: 900,
                  transformStyle: "preserve-3d",
                }}
                animate={{ y: hovered ? -8 : 0 }}
                transition={{ duration: 0.5, ease }}
                onMouseMove={handleCoverTilt}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={resetCoverTilt}
              >
                {/* memories peeking out from behind the pages */}
                {peekPhotos.map((memory, i) => (
                  <motion.div
                    key={memory.id}
                    initial={false}
                    animate={
                      hovered ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }
                    }
                    transition={{
                      delay: hovered ? 0.15 + i * 0.09 : 0,
                      duration: 0.5,
                      ease,
                    }}
                    className="album-memory-peek absolute z-0 w-[30%] rounded-[3px] p-[3px] pb-3"
                    style={{
                      ...peekPositions[i].style,
                      rotate: peekPositions[i].rotate,
                    }}
                  >
                    <img
                      src={memory.src}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/5] w-full rounded-[2px] object-cover"
                    />
                  </motion.div>
                ))}

                {/* soft shadow beneath — deepens as the book lifts */}
                <motion.div
                  aria-hidden
                  animate={{
                    opacity: hovered ? 0.75 : 0.5,
                    scaleX: hovered ? 1.08 : 1,
                  }}
                  transition={{ duration: 0.5, ease }}
                  className="absolute -bottom-7 left-1/2 h-8 w-[86%] -translate-x-1/2 rounded-[50%] bg-black/70 blur-xl"
                />

                <div className="relative z-10 h-full w-full">
                  <AlbumClosedBook className="shadow-2xl shadow-black/55" />
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: 0.45, duration: 1, ease }}
              className="text-center lg:border-l lg:border-white/10 lg:pl-14 lg:text-left"
            >
              <p className="font-serif text-2xl italic text-ivory sm:text-[1.7rem]">
                Some things are worth keeping.
              </p>
              <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-sand/65 lg:mx-0">
                Inside is a little book of you — every page holds a photograph,
                a story, and a small piece of time. Turn it slowly.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setOpen(true)}
                className="group relative mt-9 inline-flex items-center gap-4 overflow-hidden rounded-full bg-ivory px-8 py-4 text-[10px] font-medium uppercase tracking-[0.22em] text-ink shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-[background-color,box-shadow] duration-500 hover:bg-[#fff6e6] hover:shadow-[0_14px_40px_rgba(255,215,160,0.22)]"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_130%,rgba(255,210,150,0.35),transparent_65%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
                <BookOpen
                  size={15}
                  className="relative transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:-rotate-6"
                />
                <span className="relative">Open the album</span>
              </motion.button>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.85, duration: 0.8, ease }}
                className="mt-5 flex items-center justify-center gap-3 text-[9px] uppercase tracking-[0.28em] text-sand/40 lg:justify-start"
              >
                <span> Forever pages of memories</span>
                <span className="text-[#d8b77e]/70">·</span>
                <span>Made by Amorth</span>
              </motion.p>
            </motion.div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {open && (
          <AlbumOverlay
            spreads={spreads}
            canEdit={canEdit}
            onAlbumSaved={(saved) => setSpreads(saved)}
            onExited={() => {
              setOpen(false);
              document
                .getElementById("memories")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}