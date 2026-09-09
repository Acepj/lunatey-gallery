"use client";

import { motion } from "framer-motion";

/**
 * Shared sticker system used by both the memories gallery and the photo album.
 * A photo only needs the optional sticker fields for these helpers to work.
 */
export type StickerPhoto = {
  stickerIndex?: number;
  customStickerSrc?: string;
  stickerPositionX?: number;
  stickerPositionY?: number;
  stickerScale?: number;
  stickerRotation?: number;
};

export function getStickerIndex(photo: StickerPhoto): number {
  // Any saved uploaded image means "show that image" — the numeric index is
  // only a hint about which picker button it was. All built-in indices
  // (including 0) are valid selections. "No sticker" is undefined/NaN/
  // out-of-range with no image. Note: a stale leftover src from a deleted
  // upload is still shown — storage is per-browser, so another browser that
  // never held that image could not resolve it to a button otherwise.
  if (photo.customStickerSrc) {
    return Number.isFinite(photo.stickerIndex)
      ? (photo.stickerIndex as number)
      : stickerDesigns.length;
  }
  if (
    photo.stickerIndex === undefined ||
    !Number.isFinite(photo.stickerIndex) ||
    photo.stickerIndex < 0 ||
    photo.stickerIndex >= stickerDesigns.length
  ) {
    return -1;
  }
  return photo.stickerIndex;
}

export function getCustomStickerSrc(photo: StickerPhoto): string | undefined {
  // Treat blank/garbage as "no image" so a dangling upload slot can never
  // masquerade as a real uploaded sticker.
  if (typeof photo.customStickerSrc !== "string") return undefined;
  const src = photo.customStickerSrc.trim();
  return src ? src : undefined;
}

export function getStickerPlacement(
  photo: StickerPhoto,
): React.CSSProperties {
  if (photo.stickerPositionX === undefined) return {};
  return {
    left: `${photo.stickerPositionX ?? 78}%`,
    top: `${photo.stickerPositionY ?? 78}%`,
  };
}

export function getStickerScale(photo: StickerPhoto): number {
  return photo.stickerScale ?? 1;
}

export function getStickerRotation(photo: StickerPhoto): number {
  return photo.stickerRotation ?? 0;
}

/* --- Anime character stickers (SVG) --- */

function AnimeGirlStickerSvg() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <path
        d="M50 8 C26 8 16 28 18 52 C18 72 22 88 30 92 L70 92 C78 88 82 72 82 52 C84 28 74 8 50 8Z"
        fill="#3d2a4a"
        stroke="#2a1d35"
        strokeWidth="1.5"
      />
      <ellipse
        cx="50"
        cy="52"
        rx="24"
        ry="26"
        fill="#fce4d0"
        stroke="#e0c0a0"
        strokeWidth="1"
      />
      <path
        d="M26 40 C26 28 34 14 50 14 C66 14 74 28 74 40 C74 44 72 48 68 48 C64 40 58 36 50 36 C42 36 36 40 32 48 C28 48 26 44 26 40Z"
        fill="#4a3a5a"
        stroke="#2a1d35"
        strokeWidth="1.5"
      />
      <path
        d="M26 42 C24 52 26 62 28 66 C26 58 28 48 30 44Z"
        fill="#4a3a5a"
        stroke="#2a1d35"
        strokeWidth="1"
      />
      <path
        d="M74 42 C76 52 74 62 72 66 C74 58 72 48 70 44Z"
        fill="#4a3a5a"
        stroke="#2a1d35"
        strokeWidth="1"
      />
      <ellipse cx="38" cy="52" rx="5" ry="7" fill="#5b8db8" />
      <ellipse cx="38" cy="51" rx="3.5" ry="5" fill="#2a4a6a" />
      <ellipse cx="37" cy="49" rx="1.5" ry="2" fill="#fff" />
      <ellipse cx="39" cy="54" rx="1" ry="1" fill="#fff" opacity="0.6" />
      <ellipse cx="62" cy="52" rx="5" ry="7" fill="#5b8dbb" />
      <ellipse cx="62" cy="51" rx="3.5" ry="5" fill="#2a4a6a" />
      <ellipse cx="61" cy="49" rx="1.5" ry="2" fill="#fff" />
      <ellipse cx="63" cy="54" rx="1" ry="1" fill="#fff" opacity="0.6" />
      <path
        d="M33 44 Q38 42 43 44"
        fill="none"
        stroke="#3d2a4a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M57 44 Q62 42 67 44"
        fill="none"
        stroke="#3d2a4a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M50 58 L49 62"
        fill="none"
        stroke="#d0a890"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M45 67 Q50 71 55 67"
        fill="#e8a0a0"
        stroke="#c08080"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="32" cy="62" r="4" fill="#f4b0b0" opacity="0.4" />
      <circle cx="68" cy="62" r="4" fill="#f4b0b0" opacity="0.4" />
      <path
        d="M50 12 L46 8 L50 4 L54 8 Z"
        fill="#e8a5a5"
        stroke="#c18c7d"
        strokeWidth="1"
      />
    </svg>
  );
}
function AnimeCatGirlStickerSvg() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <path
        d="M28 28 L20 10 L36 22 Z"
        fill="#d4a890"
        stroke="#b88a72"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M72 28 L80 10 L64 22 Z"
        fill="#d4a890"
        stroke="#b88a72"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M26 24 L22 14 L32 21 Z" fill="#f4b8a0" opacity="0.5" />
      <path d="M74 24 L78 14 L68 21 Z" fill="#f4b8a0" opacity="0.5" />
      <path
        d="M50 8 C28 8 18 26 20 50 C20 68 24 84 30 90 L70 90 C76 84 80 68 80 50 C82 26 72 8 50 8Z"
        fill="#8b5a3c"
        stroke="#6a4228"
        strokeWidth="1.5"
      />
      <ellipse
        cx="50"
        cy="52"
        rx="22"
        ry="24"
        fill="#fce4d0"
        stroke="#e0c0a0"
        strokeWidth="1"
      />
      <path
        d="M28 38 C28 28 36 16 50 16 C64 16 72 28 72 38 C72 42 70 46 66 46 C62 38 56 34 50 34 C44 34 38 38 34 46 C30 46 28 42 28 38Z"
        fill="#9d6a4c"
        stroke="#6a4228"
        strokeWidth="1.5"
      />
      <ellipse cx="38" cy="52" rx="5" ry="6" fill="#d4a040" />
      <ellipse cx="38" cy="52" rx="2" ry="5" fill="#1a1a1a" />
      <ellipse cx="37" cy="50" rx="1.2" ry="1.5" fill="#fff" />
      <ellipse cx="62" cy="52" rx="5" ry="6" fill="#d4a040" />
      <ellipse cx="62" cy="52" rx="2" ry="5" fill="#1a1a1a" />
      <ellipse cx="61" cy="50" rx="1.2" ry="1.5" fill="#fff" />
      <path
        d="M33 44 Q38 42 43 44"
        fill="none"
        stroke="#6a4228"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M57 44 Q62 42 67 44"
        fill="none"
        stroke="#6a4228"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M45 66 Q48 70 50 68 Q52 70 55 66"
        fill="none"
        stroke="#c08080"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="62" r="4" fill="#f4b0b0" opacity="0.4" />
      <circle cx="68" cy="62" r="4" fill="#f4b0b0" opacity="0.4" />
      <line
        x1="18"
        y1="58"
        x2="30"
        y2="59"
        stroke="#b88a72"
        strokeWidth="0.8"
        opacity="0.4"
      />
      <line
        x1="18"
        y1="63"
        x2="30"
        y2="62"
        stroke="#b88a72"
        strokeWidth="0.8"
        opacity="0.4"
      />
      <line
        x1="82"
        y1="58"
        x2="70"
        y2="59"
        stroke="#b88a72"
        strokeWidth="0.8"
        opacity="0.4"
      />
      <line
        x1="82"
        y1="63"
        x2="70"
        y2="62"
        stroke="#b88a72"
        strokeWidth="0.8"
        opacity="0.4"
      />
    </svg>
  );
}
function AnimeBoyStickerSvg() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <path
        d="M50 10 C28 10 18 28 20 50 C20 68 24 86 30 90 L70 90 C76 86 80 68 80 50 C82 28 72 10 50 10Z"
        fill="#2a2a2a"
        stroke="#1a1a1a"
        strokeWidth="1.5"
      />
      <ellipse
        cx="50"
        cy="54"
        rx="22"
        ry="24"
        fill="#fce4d0"
        stroke="#e0c0a0"
        strokeWidth="1"
      />
      <path
        d="M28 36 L24 24 L34 34 L30 18 L40 32 L38 14 L48 30 L50 12 L52 30 L62 14 L60 32 L70 18 L66 34 L76 24 L72 36 C72 40 70 44 66 44 C62 38 56 34 50 34 C44 34 38 38 34 44 C30 44 28 40 28 36Z"
        fill="#3a3a3a"
        stroke="#1a1a1a"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <ellipse cx="38" cy="54" rx="4.5" ry="6" fill="#4a7a4a" />
      <ellipse cx="38" cy="53" rx="3" ry="4.5" fill="#2a4a2a" />
      <ellipse cx="37" cy="51" rx="1.3" ry="1.8" fill="#fff" />
      <ellipse cx="62" cy="54" rx="4.5" ry="6" fill="#4a7a4a" />
      <ellipse cx="62" cy="53" rx="3" ry="4.5" fill="#2a4a2a" />
      <ellipse cx="61" cy="51" rx="1.3" ry="1.8" fill="#fff" />
      <path
        d="M32 46 L43 44"
        fill="none"
        stroke="#2a2a2a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M57 44 L68 46"
        fill="none"
        stroke="#2a2a2a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M50 60 L49 64"
        fill="none"
        stroke="#d0a890"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M44 68 Q50 72 56 68"
        fill="none"
        stroke="#c08080"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="33" cy="64" r="3" fill="#f4b0b0" opacity="0.25" />
      <circle cx="67" cy="64" r="3" fill="#f4b0b0" opacity="0.25" />
    </svg>
  );
}
function AnimeMascotStickerSvg() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <ellipse
        cx="50"
        cy="55"
        rx="34"
        ry="34"
        fill="#e8c8a0"
        stroke="#c4a878"
        strokeWidth="2"
      />
      <ellipse
        cx="30"
        cy="28"
        rx="8"
        ry="10"
        fill="#e8c8a0"
        stroke="#c4a878"
        strokeWidth="2"
      />
      <ellipse
        cx="70"
        cy="28"
        rx="8"
        ry="10"
        fill="#e8c8a0"
        stroke="#c4a878"
        strokeWidth="2"
      />
      <ellipse cx="30" cy="28" rx="4" ry="6" fill="#f4b0b0" opacity="0.5" />
      <ellipse cx="70" cy="28" rx="4" ry="6" fill="#f4b0b0" opacity="0.5" />
      <ellipse cx="36" cy="50" rx="7" ry="9" fill="#2a2a2a" />
      <ellipse cx="36" cy="48" rx="4" ry="5" fill="#5b8db8" />
      <ellipse cx="35" cy="46" rx="2" ry="2.5" fill="#fff" />
      <ellipse cx="37" cy="52" rx="1.5" ry="1" fill="#fff" opacity="0.6" />
      <ellipse cx="64" cy="50" rx="7" ry="9" fill="#2a2a2a" />
      <ellipse cx="64" cy="48" rx="4" ry="5" fill="#5b8db8" />
      <ellipse cx="63" cy="46" rx="2" ry="2.5" fill="#fff" />
      <ellipse cx="65" cy="52" rx="1.5" ry="1" fill="#fff" opacity="0.6" />
      <path
        d="M46 66 Q50 69 54 66"
        fill="none"
        stroke="#8a6a4a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="28" cy="60" r="6" fill="#f4b0b0" opacity="0.5" />
      <circle cx="72" cy="60" r="6" fill="#f4b0b0" opacity="0.5" />
      <path d="M78 22 L80 18 L82 22 L80 26 Z" fill="#f0d09a" />
      <path d="M22 22 L24 18 L26 22 L24 26 Z" fill="#f0d09a" />
    </svg>
  );
}
function AnimePrincessStickerSvg() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <path
        d="M50 8 C24 8 14 30 16 56 C16 76 22 92 28 94 L72 94 C78 92 84 76 84 56 C86 30 76 8 50 8Z"
        fill="#c4a050"
        stroke="#a08038"
        strokeWidth="1.5"
      />
      <path
        d="M36 18 L40 10 L44 16 L50 8 L56 16 L60 10 L64 18 L62 22 L38 22 Z"
        fill="#f0d09a"
        stroke="#c4a06a"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="14" r="2" fill="#e8a5a5" />
      <ellipse
        cx="50"
        cy="52"
        rx="22"
        ry="24"
        fill="#fce4d0"
        stroke="#e0c0a0"
        strokeWidth="1"
      />
      <path
        d="M28 40 C28 28 36 20 50 20 C64 20 72 28 72 40 C72 44 70 48 66 48 C62 40 56 36 50 36 C44 36 38 40 34 48 C30 48 28 44 28 40Z"
        fill="#d4b060"
        stroke="#a08038"
        strokeWidth="1.5"
      />
      <path
        d="M22 48 C20 60 22 74 26 82 C24 70 24 58 26 50Z"
        fill="#d4b060"
        stroke="#a08038"
        strokeWidth="1"
      />
      <path
        d="M78 48 C80 60 78 74 74 82 C76 70 76 58 74 50Z"
        fill="#d4b060"
        stroke="#a08038"
        strokeWidth="1"
      />
      <ellipse cx="38" cy="52" rx="5.5" ry="7.5" fill="#a04060" />
      <ellipse cx="38" cy="51" rx="4" ry="5.5" fill="#c46080" />
      <ellipse cx="37" cy="49" rx="2" ry="2.5" fill="#fff" />
      <ellipse cx="39" cy="55" rx="1.2" ry="1" fill="#fff" opacity="0.6" />
      <ellipse cx="62" cy="52" rx="5.5" ry="7.5" fill="#a04060" />
      <ellipse cx="62" cy="51" rx="4" ry="5.5" fill="#c46080" />
      <ellipse cx="61" cy="49" rx="2" ry="2.5" fill="#fff" />
      <ellipse cx="63" cy="55" rx="1.2" ry="1" fill="#fff" opacity="0.6" />
      <path
        d="M32 44 Q38 42 44 44"
        fill="none"
        stroke="#a08038"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M56 44 Q62 42 68 44"
        fill="none"
        stroke="#a08038"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M50 58 L49 62"
        fill="none"
        stroke="#d0a890"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M44 67 Q50 72 56 67"
        fill="#e8a0a0"
        stroke="#c08080"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="31" cy="62" r="4.5" fill="#f4b0b0" opacity="0.45" />
      <circle cx="69" cy="62" r="4.5" fill="#f4b0b0" opacity="0.45" />
    </svg>
  );
}
function AnimeNinjaStickerSvg() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <path
        d="M50 8 C28 8 18 28 20 50 C20 68 24 86 30 90 L70 90 C76 86 80 68 80 50 C82 28 72 8 50 8Z"
        fill="#2a2a3a"
        stroke="#1a1a2a"
        strokeWidth="1.5"
      />
      <ellipse
        cx="50"
        cy="52"
        rx="22"
        ry="24"
        fill="#fce4d0"
        stroke="#e0c0a0"
        strokeWidth="1"
      />
      <rect
        x="24"
        y="36"
        width="52"
        height="8"
        fill="#c44040"
        stroke="#a02020"
        strokeWidth="1"
        rx="2"
      />
      <path
        d="M76 38 C84 36 88 42 86 50 C84 44 80 42 76 44Z"
        fill="#c44040"
        stroke="#a02020"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M28 36 C28 28 36 20 50 20 C64 20 72 28 72 36Z"
        fill="#1a1a2a"
        stroke="#0a0a1a"
        strokeWidth="1"
      />
      <ellipse cx="38" cy="54" rx="4.5" ry="5.5" fill="#2a2a2a" />
      <ellipse cx="38" cy="53" rx="3" ry="4" fill="#4a4a6a" />
      <ellipse cx="37" cy="51" rx="1.3" ry="1.8" fill="#fff" />
      <ellipse cx="62" cy="54" rx="4.5" ry="5.5" fill="#2a2a2a" />
      <ellipse cx="62" cy="53" rx="3" ry="4" fill="#4a4a6a" />
      <ellipse cx="61" cy="51" rx="1.3" ry="1.8" fill="#fff" />
      <path
        d="M28 62 C28 72 34 80 50 80 C66 80 72 72 72 62 C72 60 70 58 68 58 L32 58 C30 58 28 60 28 62Z"
        fill="#2a2a3a"
        stroke="#1a1a2a"
        strokeWidth="1.5"
      />
      <line
        x1="30"
        y1="66"
        x2="70"
        y2="66"
        stroke="#1a1a2a"
        strokeWidth="0.8"
      />
      <rect x="44" y="38" width="12" height="4" fill="#a0a0b0" rx="1" />
      <circle cx="50" cy="40" r="1.5" fill="#1a1a2a" />
    </svg>
  );
}
export const stickerDesigns = [
  AnimeGirlStickerSvg,
  AnimeCatGirlStickerSvg,
  AnimeBoyStickerSvg,
  AnimeMascotStickerSvg,
  AnimePrincessStickerSvg,
  AnimeNinjaStickerSvg,
];
export const stickerPositions = [
  "top-3 right-3",
  "top-3 left-3",
  "bottom-3 right-3",
  "bottom-3 left-3",
];

export function MemorySticker({
  stickerIndex,
  customStickerSrc,
  positionClass,
  index = 0,
  revealOnHover = false,
  style,
  stickerScale = 1,
  stickerRotation,
  interactive = false,
  onPointerDown,
}: {
  stickerIndex: number;
  customStickerSrc?: string;
  positionClass?: string;
  index?: number;
  revealOnHover?: boolean;
  style?: React.CSSProperties;
  stickerScale?: number;
  stickerRotation?: number;
  interactive?: boolean;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
}) {
  const position =
    positionClass ??
    (style ? "" : stickerPositions[index % stickerPositions.length]);
  const rotation = ((stickerIndex * 37) % 24) - 12;
  // An uploaded image is a sticker in its own right — even if the numeric
  // index was never set (older saves), the image always wins.
  const isCustom = customStickerSrc !== undefined && customStickerSrc !== "";
  // No sticker chosen (callers pass -1 for "none"), or a dangling custom
  // index whose image is gone — render nothing instead of the wrong sticker
  // (or crashing on an out-of-range design lookup).
  if (
    !isCustom &&
    (!Number.isFinite(stickerIndex) ||
      stickerIndex < 0 ||
      stickerIndex >= stickerDesigns.length)
  ) {
    return null;
  }
  return (
    <motion.div
      initial={
        revealOnHover
          ? "hidden"
          : { scale: 0, rotate: rotation - 15, opacity: 0 }
      }
      animate={
        revealOnHover ? undefined : { scale: 1, rotate: rotation, opacity: 1 }
      }
      whileHover={revealOnHover ? undefined : { y: -6 }}
      variants={
        revealOnHover
          ? {
              hidden: {
                opacity: 0,
                y: 20,
                scale: stickerScale * 0.85,
                rotate: stickerRotation ?? rotation - 5,
              },
              hover: {
                opacity: 1,
                y: 0,
                scale: stickerScale,
                rotate: stickerRotation ?? rotation,
              },
            }
          : undefined
      }
      viewport={{ once: true }}
      transition={
        revealOnHover
          ? { duration: 0.5, ease: "easeOut" }
          : {
              delay: 0.3 + (index % 3) * 0.1,
              type: "spring",
              stiffness: 180,
              damping: 14,
            }
      }
      style={style}
      onPointerDown={onPointerDown}
      className={`absolute ${position} z-10 ${revealOnHover ? "pointer-events-none" : ""} ${interactive ? "pointer-events-auto cursor-move rounded-md ring-1 ring-blush/70 ring-offset-2 ring-offset-ink" : ""}`}
    >
      <div className="h-11 w-11 rounded-full border-2 border-ivory bg-ivory/95 p-0.5 shadow-lg shadow-black/40 backdrop-blur-sm transition-transform duration-300 md:h-14 md:w-14">
        {isCustom && customStickerSrc ? (
          <img
            src={customStickerSrc}
            alt="Custom sticker"
            className="h-full w-full rounded-full object-contain"
          />
        ) : (
          (() => {
            const Sticker =
              stickerDesigns[stickerIndex % stickerDesigns.length];
            return <Sticker />;
          })()
        )}
      </div>
    </motion.div>
  );
}