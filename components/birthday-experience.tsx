"use client";

import {
  ChangeEvent,
  CSSProperties,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  startTransition,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  Heart,
  ImagePlus,
  Menu,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { birthday, Memory } from "@/data/birthday";
import {
  readUploadedPhotos,
  saveUploadedPhotos,
  removeUploadedPhoto,
  UploadedPhoto,
  uploadPhoto,
  readCustomStickers,
  saveCustomSticker,
  removeCustomSticker,
  replaceUploadedPhoto,
  updateUploadedPhoto,
  CustomSticker,
  uploadSticker,
} from "@/lib/upload-service";
import {
  getCustomStickerSrc,
  getStickerIndex,
  getStickerPlacement,
  getStickerRotation,
  getStickerScale,
  MemorySticker,
  stickerDesigns,
} from "./stickers";
import PhotoAlbumSection from "./photo-album";
import { seedSamplePictures } from "@/lib/sample-pictures";
import {
  scheduleSave,
  useSaveSyncState,
} from "@/lib/album-sync";

type GalleryPhoto = Memory | UploadedPhoto;

const ease = [0.22, 1, 0.36, 1] as const;

const atmosphereStars = Array.from({ length: 36 }, (_, index) => ({
  left: `${8 + ((index * 47) % 84)}%`,
  top: `${5 + ((index * 67) % 88)}%`,
  size: `${index % 6 === 0 ? 4 : index % 3 === 0 ? 3 : 2}px`,
  opacity: `${0.18 + (index % 5) * 0.06}`,
  delay: `${-((index * 1.37) % 8)}s`,
  duration: `${3 + (index % 6)}s`,
  cross: index % 7 === 0 || index % 11 === 0,
}));

const moonPhases = [
  "moon-phase--crescent-right",
  "moon-phase--half-left",
  "moon-phase--full",
  "moon-phase--half-right",
  "moon-phase--crescent-left",
] as const;

/* Shared navigation targets — used by both the desktop bar and the
   mobile/tablet menu so they never drift apart. */
const navLinks: {
  href: string;
  label: string;
  celebrantOnly?: boolean;
}[] = [
  { href: "#memories", label: "Memories" },
  { href: "#album", label: "Album" },
  { href: "#add", label: "Add a photo", celebrantOnly: true },
  { href: "#letter", label: "Letter" },
];

const visibleNavLinks = (isCelebrant: boolean) =>
  navLinks.filter((link) => !link.celebrantOnly || isCelebrant);

function isUploadedPhoto(photo: GalleryPhoto): photo is UploadedPhoto {
  return !birthday.memories.some((memory) => memory.id === photo.id);
}

export default function BirthdayExperience() {
  const [isLoading, setIsLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [photos, setPhotos] = useState<GalleryPhoto[]>(birthday.memories);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [letterOpen, setLetterOpen] = useState(false);
  /* The celebrant is always unlocked — no passphrase, no lock screen, and no
     dividing visitors from contributor. The website opens straight into the
     full experience on every device. */
  const isCelebrant = true;

  /* Reliable in-page navigation for every device. Touch browsers are flaky
     with default anchor jumps while the mobile menu collapses at the same
     time, so we close the menu first and scroll manually on the next frame,
     measuring the real header height so sections never land underneath it. */
  const headerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const navigateToSection = (event: { preventDefault: () => void }, href: string) => {
    event.preventDefault();
    setMobileMenu(false);

    requestAnimationFrame(() => {
      const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";
      const targetId = href.replace(/^#/, "");

      if (!targetId || targetId === "top") {
        window.scrollTo({ top: 0, behavior });
        return;
      }

      const target = document.getElementById(targetId);
      if (!target) {
        // Fall back to the browser's native anchor handling.
        window.location.hash = href;
        return;
      }

      const headerHeight = headerRef.current?.offsetHeight ?? 76;
      const top =
        target.getBoundingClientRect().top + window.scrollY - headerHeight - 8;

      window.scrollTo({ top: Math.max(top, 0), behavior });
    });
  };

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedSticker, setSelectedSticker] = useState(0);
  const [customStickers, setCustomStickers] = useState<CustomSticker[]>([]);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    date: "",
    title: "",
    caption: "",
  });
  const [stickerEdit, setStickerEdit] = useState({
    x: 78,
    y: 78,
    scale: 0.34,
    rotation: -4,
  });
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacePreview, setReplacePreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const detailFrameRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Mouse parallax for hero image
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 40, damping: 20, mass: 0.5 });
  const springY = useSpring(mouseY, { stiffness: 40, damping: 20, mass: 0.5 });
  const imgX = useTransform(springX, [-0.5, 0.5], [-12, 12]);
  const imgY = useTransform(springY, [-0.5, 0.5], [-8, 8]);
  const { scrollYProgress } = useScroll();
  const moonX = useTransform(springX, [-0.5, 0.5], [-6, 6]);
  const moonY = useTransform(scrollYProgress, [0, 1], [0, -12]);
  const planetX = useTransform(springX, [-0.5, 0.5], [-8, 8]);
  const saturnX = useTransform(springX, [-0.5, 0.5], [-10, 10]);
  const sunX = useTransform(springX, [-0.5, 0.5], [-6, 6]);
  const marsX = useTransform(springX, [-0.5, 0.5], [-5, 5]);
  const venusX = useTransform(springX, [-0.5, 0.5], [-4, 4]);
  const distantX = useTransform(springX, [-0.5, 0.5], [-2, 2]);
  const backgroundStarsX = useTransform(springX, [-0.5, 0.5], [-3, 3]);
  const backgroundStarsY = useTransform(scrollYProgress, [0, 1], [0, -10]);
  const foregroundStarsX = useTransform(springX, [-0.5, 0.5], [-8, 8]);
  const foregroundStarsY = useTransform(scrollYProgress, [0, 1], [0, -22]);

  useEffect(() => {
    /* First run on this device gets the sample pictures (once). */
    seedSamplePictures();
    const timer = window.setTimeout(() => setIsLoading(false), 1600);
    startTransition(() => {
      setPhotos([
        ...readUploadedPhotos().filter(
          (photo) => !photo.id.startsWith("album-upload-"),
        ),
        ...birthday.memories,
      ]);
      setCustomStickers(readCustomStickers());
    });
    return () => window.clearTimeout(timer);
  }, []);

  /* Cloud sync: the save-status hook loads the shared cloud copy on mount and
     bumps `revision` whenever a remote snapshot is applied (for example,
     photos added on another phone). Re-reading storage here is what makes
     other devices' photos, albums and stickers appear automatically. */
  const saveSync = useSaveSyncState();

  useEffect(() => {
    /* A cloud snapshot may have arrived, so top up the samples if the local
       store is empty again (for example a fresh cloud copy with no photos). */
    seedSamplePictures();
    startTransition(() => {
      setPhotos([
        ...readUploadedPhotos().filter(
          (photo) => !photo.id.startsWith("album-upload-"),
        ),
        ...birthday.memories,
      ]);
      setCustomStickers(readCustomStickers());
    });
  }, [saveSync.revision]);

  /** Push the current memories/stickers to the cloud (reads fresh storage). */
  function queueCloudSaveNow(): void {
    void scheduleSave({
      memories: readUploadedPhotos(),
      customStickers: readCustomStickers(),
    });
  }

  /* The celebrant is always unlocked — no passphrase, no key, no lock. All
     of these helpers existed only for the removed passphrase system. */

  useEffect(() => {
    return () => {
      if (replacePreview) URL.revokeObjectURL(replacePreview);
    };
  }, [replacePreview]);

  useEffect(() => {
    if (!photoNotice) return;
    const timer = window.setTimeout(() => setPhotoNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [photoNotice]);

  function handleHeroMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
    if (reduceMotion || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  }

  function handleHeroMouseLeave(): void {
    mouseX.set(0);
    mouseY.set(0);
  }

  async function handleStickerUpload(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const files = event.target.files;
    if (!files) return;
    const newStickers: CustomSticker[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        const sticker = await uploadSticker(file);
        saveCustomSticker(sticker);
        newStickers.push(sticker);
      }
    }
    setCustomStickers((current) => [...newStickers, ...current]);
    if (newStickers.length > 0) {
      setSelectedSticker(stickerDesigns.length);
      queueCloudSaveNow();
    }
    event.target.value = "";
  }

  function deleteCustomSticker(
    stickerId: string,
    stickerAbsoluteIndex: number,
  ): void {
    removeCustomSticker(stickerId);
    queueCloudSaveNow();
    setCustomStickers((current) => current.filter((s) => s.id !== stickerId));
    if (selectedSticker === stickerAbsoluteIndex) {
      setSelectedSticker(0);
    } else if (selectedSticker > stickerAbsoluteIndex) {
      setSelectedSticker((s) => s - 1);
    }
  }

  const selectedPhoto = selectedIndex === null ? null : photos[selectedIndex];
  const uploadLabel = useMemo(() => {
    if (uploading) return "Saving your memories...";
    if (uploaded) return "Your memories are in the gallery";
    return "Upload selected photos";
  }, [uploaded, uploading]);

  function chooseFiles(files: FileList | File[]): void {
    const images = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    setPendingFiles((current) => [...current, ...images]);
    setUploaded(false);
    setUploadError(null);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files) chooseFiles(event.target.files);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    chooseFiles(event.dataTransfer.files);
  }

  function removePendingFile(indexToRemove: number): void {
    setPendingFiles((current) =>
      current.filter((_, index) => index !== indexToRemove),
    );
    setUploadError(null);
  }

  async function savePhotos(): Promise<void> {
    if (!pendingFiles.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      const customIdx = selectedSticker - stickerDesigns.length;
      const customSrc =
        customIdx >= 0 && customIdx < customStickers.length
          ? customStickers[customIdx].src
          : undefined;
      const savedPhotos = await Promise.all(
        pendingFiles.map((file) =>
          uploadPhoto(file, selectedSticker, customSrc),
        ),
      );
      saveUploadedPhotos(savedPhotos);
      setPhotos((current) => [...savedPhotos, ...current]);
      setPendingFiles([]);
      setUploaded(true);
      queueCloudSaveNow();
    } catch {
      setUploadError(
        "Those photos could not be saved. Try a smaller batch or smaller image files.",
      );
    } finally {
      setUploading(false);
    }
  }

  function deleteUploadedPhoto(photo: GalleryPhoto): void {
    if (!isUploadedPhoto(photo) || selectedIndex === null) return;
    removeUploadedPhoto(photo.id);
    queueCloudSaveNow();
    const deletedIndex = selectedIndex;
    const nextLength = photos.length - 1;
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
    if (nextLength === 0) {
      setSelectedIndex(null);
    } else {
      setSelectedIndex(Math.min(deletedIndex, nextLength - 1));
    }
  }

  function beginPhotoEdit(photo: UploadedPhoto): void {
    setEditingPhotoId(photo.id);
    setEditValues({
      date: photo.date,
      title: photo.title,
      caption: photo.caption,
    });
    setStickerEdit({
      x: photo.stickerPositionX ?? 78,
      y: photo.stickerPositionY ?? 78,
      scale: photo.stickerScale ?? 1,
      rotation: photo.stickerRotation ?? -4,
    });
    setReplaceFile(null);
    setReplacePreview(null);
    setRemoveConfirmOpen(false);
    setPhotoNotice(null);
  }

  function cancelPhotoEdit(): void {
    setEditingPhotoId(null);
    setReplaceFile(null);
    setReplacePreview(null);
    setRemoveConfirmOpen(false);
  }

  function chooseReplacement(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setReplaceFile(file);
    setReplacePreview(URL.createObjectURL(file));
    event.target.value = "";
  }

  function handleStickerDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (!isCelebrant || !editingPhotoId || !detailFrameRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const frame = detailFrameRef.current;
    const updatePosition = (moveEvent: PointerEvent) => {
      const bounds = frame.getBoundingClientRect();
      const x = Math.max(
        12,
        Math.min(88, ((moveEvent.clientX - bounds.left) / bounds.width) * 100),
      );
      const y = Math.max(
        12,
        Math.min(88, ((moveEvent.clientY - bounds.top) / bounds.height) * 100),
      );
      setStickerEdit((current) => ({ ...current, x, y }));
    };
    const stopDragging = () => {
      window.removeEventListener("pointermove", updatePosition);
      window.removeEventListener("pointerup", stopDragging);
    };
    window.addEventListener("pointermove", updatePosition);
    window.addEventListener("pointerup", stopDragging, { once: true });
  }

  async function savePhotoChanges(): Promise<void> {
    if (!selectedPhoto || !isUploadedPhoto(selectedPhoto)) return;
    setSavingEdit(true);
    try {
      let updatedPhoto = selectedPhoto;
      if (replaceFile) {
        const replaced = await replaceUploadedPhoto(
          selectedPhoto.id,
          replaceFile,
        );
        if (!replaced) throw new Error("Photo not found");
        updatedPhoto = replaced;
      }
      const saved = updateUploadedPhoto(selectedPhoto.id, {
        ...editValues,
        stickerPositionX: stickerEdit.x,
        stickerPositionY: stickerEdit.y,
        stickerScale: stickerEdit.scale,
        stickerRotation: stickerEdit.rotation,
      });
      if (!saved) throw new Error("Photo not found");
      updatedPhoto = { ...updatedPhoto, ...saved, ...editValues };
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === updatedPhoto.id ? updatedPhoto : photo,
        ),
      );
      setEditingPhotoId(null);
      setReplaceFile(null);
      setReplacePreview(null);
      setPhotoNotice("Memory updated");
      queueCloudSaveNow();
    } catch {
      setPhotoNotice("This memory could not be updated.");
    } finally {
      setSavingEdit(false);
    }
  }

  function confirmPhotoRemoval(): void {
    if (!selectedPhoto) return;
    deleteUploadedPhoto(selectedPhoto);
    setSelectedIndex(null);
    setEditingPhotoId(null);
    setRemoveConfirmOpen(false);
    setPhotoNotice("Memory removed");
  }

  function movePhoto(direction: number): void {
    if (selectedIndex === null) return;
    setSelectedIndex(
      (selectedIndex + direction + photos.length) % photos.length,
    );
  }

  // Hero entrance timing constants
  const navDelay = 0.2;
  const imgDelay = 0.4;
  const happyDelay = 0.9;
  const birthdayDelay = 1.15;
  const lineDelay = 1.0;
  const paraDelay = 1.5;
  const btnDelay = 1.8;

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink text-ivory selection:bg-blush selection:text-ink">
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0 : 1 }}
          transition={{ delay: 0.25, duration: 1.8, ease }}
          className="absolute inset-0"
          style={
            reduceMotion
              ? undefined
              : { x: backgroundStarsX, y: backgroundStarsY }
          }
        >
          {atmosphereStars.slice(0, 18).map((star, index) => (
            <span
              key={`background-star-${index}`}
              className={`night-star ${star.cross ? "night-star--cross" : ""}`}
              style={
                {
                  "--star-left": star.left,
                  "--star-top": star.top,
                  "--star-size": star.size,
                  "--star-opacity": star.opacity,
                  "--star-delay": star.delay,
                  "--star-duration": star.duration,
                } as CSSProperties
              }
            />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{
            opacity: isLoading ? 0 : 0.42,
            scale: isLoading ? 0.96 : 1,
          }}
          transition={{ delay: 0.45, duration: 2.2, ease }}
          className="absolute -right-32 top-[9vh] h-[min(48vw,34rem)] w-[min(48vw,34rem)]"
          style={reduceMotion ? undefined : { x: moonX, y: moonY }}
        >
          <div
            className="night-moon relative h-full w-full rounded-full opacity-70"
            style={
              reduceMotion
                ? undefined
                : { animation: "night-moon-float 13s ease-in-out infinite" }
            }
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{
            opacity: isLoading ? 0 : 0.3,
            scale: isLoading ? 0.94 : 1,
          }}
          transition={{ delay: 0.15, duration: 2.6, ease }}
          className="absolute -bottom-40 -right-40 h-[min(62vw,30rem)] w-[min(62vw,30rem)] sm:-bottom-48 sm:-right-40"
          style={reduceMotion ? undefined : { x: planetX }}
        >
          <div className="celestial-planet h-full w-full" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{
            opacity: isLoading ? 0 : 0.28,
            scale: isLoading ? 0.96 : 1,
          }}
          transition={{ delay: 0.3, duration: 2.8, ease }}
          className="absolute -bottom-44 -left-32 h-[min(50vw,24rem)] w-[min(50vw,24rem)] sm:-bottom-48 sm:-left-24"
          style={reduceMotion ? undefined : { x: saturnX }}
        >
          <div className="celestial-saturn h-full w-full">
            <span className="celestial-saturn__rings" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: isLoading ? 0 : 1, scale: isLoading ? 0.96 : 1 }}
          transition={{ delay: 0.2, duration: 2.4, ease }}
          className="absolute -left-24 top-[12vh] h-56 w-56 sm:-left-28 sm:h-72 sm:w-72"
          style={reduceMotion ? undefined : { x: sunX }}
        >
          <div className="celestial-sun h-full w-full" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{
            opacity: isLoading ? 0 : 0.3,
            scale: isLoading ? 0.92 : 1,
          }}
          transition={{ delay: 0.5, duration: 2.2, ease }}
          className="absolute right-[12%] top-[54vh] h-16 w-16"
          style={reduceMotion ? undefined : { x: marsX }}
        >
          <div className="celestial-mars h-full w-full" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{
            opacity: isLoading ? 0 : 0.22,
            scale: isLoading ? 0.92 : 1,
          }}
          transition={{ delay: 0.65, duration: 2.3, ease }}
          className="absolute left-[10%] top-[72vh] h-20 w-20"
          style={reduceMotion ? undefined : { x: venusX }}
        >
          <div className="celestial-venus h-full w-full" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0 : 1 }}
          transition={{ delay: 0.75, duration: 2, ease }}
          className="absolute inset-0"
          style={reduceMotion ? undefined : { x: distantX }}
        >
          <span className="celestial-distant celestial-distant--one opacity-40" />
          <span className="celestial-distant celestial-distant--two opacity-30" />
          <span className="celestial-distant celestial-distant--three opacity-50" />
        </motion.div>

        <span className="shooting-star" />
        <span className="shooting-star shooting-star--reverse" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0 : 1 }}
          transition={{ delay: 0.7, duration: 2.1, ease }}
          className="absolute inset-0"
          style={
            reduceMotion
              ? undefined
              : { x: foregroundStarsX, y: foregroundStarsY }
          }
        >
          {atmosphereStars.slice(18).map((star, index) => (
            <span
              key={`foreground-star-${index}`}
              className={`night-star ${star.cross ? "night-star--cross" : ""}`}
              style={
                {
                  "--star-left": star.left,
                  "--star-top": star.top,
                  "--star-size": star.size,
                  "--star-opacity": star.opacity,
                  "--star-delay": star.delay,
                  "--star-duration": star.duration,
                } as CSSProperties
              }
            />
          ))}
        </motion.div>

        <div
          className="absolute left-1/2 top-[17vh] z-0 flex -translate-x-1/2 items-center gap-2.5 opacity-60 md:gap-5"
          aria-hidden="true"
        >
          {moonPhases.map((phase, index) => (
            <motion.span
              key={phase}
              initial={{ opacity: 0, y: 7, scale: 0.9 }}
              animate={{
                opacity: isLoading ? 0 : 1,
                y: isLoading ? 7 : 0,
                scale: isLoading ? 0.9 : 1,
              }}
              transition={{
                delay: 0.16 + index * 0.16,
                duration: 0.75,
                ease,
              }}
            >
              <span
                className={`moon-phase ${phase}`}
                style={
                  {
                    "--phase-float-delay": `${index * 0.55}s`,
                    "--phase-float-duration": `${6 + index * 0.7}s`,
                  } as CSSProperties
                }
              />
            </motion.span>
          ))}
        </div>
      </div>
      <AnimatePresence>{isLoading && <LoadingScreen />}</AnimatePresence>
      <AnimatePresence>
        {photoNotice && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-blush/30 bg-ink/90 px-5 py-3 text-xs text-blush shadow-2xl shadow-black/30 backdrop-blur-md"
          >
            {photoNotice}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Auto-save indicator — “Saving… / Saved ✓ / Failed to save”.
          It only shows “Saved ✓” after the cloud accepted the newest state;
          without a cloud token it still reports “Saved on this device”. */}
      <AnimatePresence>
        {saveSync.saveStatus !== "idle" && (
          <motion.p
            key={saveSync.saveStatus}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            title={saveSync.saveMessage || "Save status"}
            className={`fixed bottom-6 left-6 z-[70] flex items-center gap-2 rounded-full border px-4 py-2 text-[9px] uppercase tracking-[0.18em] shadow-2xl shadow-black/30 backdrop-blur-md ${
              saveSync.saveStatus === "error"
                ? "border-red-300/40 bg-ink/90 text-red-300"
                : saveSync.saveStatus === "saving"
                  ? "border-white/20 bg-ink/90 text-sand/70"
                  : "border-blush/30 bg-ink/90 text-blush"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                saveSync.saveStatus === "error"
                  ? "bg-red-300"
                  : saveSync.saveStatus === "saving"
                    ? "animate-pulse bg-sand/70"
                    : "bg-blush"
              }`}
            />
            {saveSync.saveStatus === "saving"
              ? "Saving…"
              : saveSync.saveStatus === "error"
                ? "Failed to save"
                : saveSync.cloud.on
                  ? "Saved ✓"
                  : "Saved on this device"}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <motion.header
        ref={headerRef}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? -8 : 0 }}
        transition={{ delay: navDelay, duration: 1.2, ease }}
        className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-ink/80 backdrop-blur-md"
      >
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-6 md:px-10 lg:px-16">
          <a
            href="#top"
            onClick={(event) => navigateToSection(event, "#top")}
            className="font-serif text-lg italic tracking-tight transition-opacity duration-300 hover:opacity-80"
          >
            a little something
          </a>
          <nav className="hidden items-center gap-10 text-[10px] uppercase tracking-[0.24em] text-sand/70 md:flex">
            {visibleNavLinks(isCelebrant).map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                onNavigate={navigateToSection}
              />
            ))}
          </nav>
          <button
            aria-label="Toggle menu"
            aria-expanded={mobileMenu}
            className="rounded-full p-2 text-sand transition hover:bg-white/10 active:bg-white/15 md:hidden"
            onClick={() => setMobileMenu((open) => !open)}
          >
            {mobileMenu ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
        <AnimatePresence>
          {mobileMenu && (
            /* Overlay panel instead of a height-animated dropdown: no
               measured inline heights, so it can never clip links on
               phones or tablets (Safari's collapsing URL bar, orientation
               changes, late-loading fonts, …). */
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease }}
              className="absolute inset-x-0 top-full max-h-[calc(100dvh-76px)] overflow-y-auto border-t border-white/10 bg-ink/95 px-6 py-5 backdrop-blur-md md:hidden"
            >
              <div className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.24em] text-sand/80">
                {visibleNavLinks(isCelebrant).map((item, i) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    onClick={(event) => navigateToSection(event, item.href)}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.06, duration: 0.4, ease }}
                    className="-mx-2 rounded-lg px-2 py-3 transition-colors duration-300 hover:bg-white/5 hover:text-ivory active:bg-white/10"
                  >
                    {item.label}
                  </motion.a>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Hero */}
      <section
        id="top"
        ref={heroRef}
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
        className="relative mx-auto flex min-h-screen max-w-[1440px] items-center px-6 pb-20 pt-32 md:px-10 lg:px-16 lg:pt-24"
      >
        {/* Vertical decorative line — grows top to bottom */}
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: isLoading ? 0 : 1 }}
          transition={{ delay: lineDelay, duration: 1.4, ease }}
          style={{ transformOrigin: "top" }}
          className="absolute left-[4%] top-[28%] hidden h-[44%] w-px bg-gradient-to-b from-blush/50 via-sand/20 to-transparent lg:block"
        />
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0 : 1 }}
          transition={{ delay: lineDelay + 0.8, duration: 1, ease }}
          className="absolute left-[4%] top-[28%] hidden -translate-y-7 text-[9px] uppercase tracking-[0.28em] text-sand/45 [writing-mode:vertical-rl] lg:block"
        >
          A private place for beautiful things
        </motion.span>

        <div className="grid w-full items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          {/* Text column */}
          <div className="relative z-10 max-w-xl lg:pl-12">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: isLoading ? 0 : 1 }}
              transition={{ delay: happyDelay - 0.2, duration: 0.8, ease }}
              className="mb-8 text-[10px] uppercase tracking-[0.36em] text-blush"
            >
              For someone special
            </motion.p>
            {/* "Happy" — fades in while moving upward ~20px */}
            <h1 className="font-sans text-[clamp(4.5rem,10vw,9.5rem)] font-light leading-[0.83] tracking-[-0.075em] text-ivory">
              <motion.span
                className="block"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 20 : 0 }}
                transition={{ delay: happyDelay, duration: 1.1, ease }}
              >
                Happy
              </motion.span>
              {/* "Birthday" — appears after Happy, slower fade/slide */}
              <motion.span
                className="block font-serif italic font-normal tracking-[-0.06em] text-sand"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 16 : 0 }}
                transition={{ delay: birthdayDelay, duration: 1.4, ease }}
              >
                Birthday Lunatey
              </motion.span>
            </h1>
            {/* Paragraph text — fades in after title */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 12 : 0 }}
              transition={{ delay: paraDelay, duration: 1, ease }}
              className="mt-12 max-w-sm border-l border-blush/60 pl-5 text-sm leading-7 text-sand/75 md:ml-3"
            >
              <p className="mb-2 font-serif text-xl italic text-ivory">
                Today is all about you.
              </p>
              <p>
                A little place filled with memories, photographs, and a message
                I wanted you to have.
              </p>
            </motion.div>
            {/* Buttons — appear last with subtle upward fade */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 10 : 0 }}
              transition={{ delay: btnDelay, duration: 0.9, ease }}
              className="mt-10 flex flex-wrap gap-3"
            >
              <a
                href="#memories"
                className="group inline-flex items-center gap-4 rounded-full bg-ivory px-6 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-ink transition-all duration-300 hover:bg-blush hover:scale-[1.03]"
              >
                <span>Explore memories</span>
                <ArrowDown
                  size={14}
                  className="transition-transform duration-300 group-hover:translate-y-1"
                />
              </a>
              <a
                href="#letter"
                className="group inline-flex items-center gap-3 rounded-full border border-white/25 px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-ivory transition-all duration-300 hover:border-white/80 hover:bg-white/5"
              >
                <span className="transition-transform duration-300 group-hover:-translate-y-px">
                  Read my letter
                </span>
              </a>
            </motion.div>
          </div>

          {/* Hero image column */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 30 : 0 }}
            transition={{ delay: imgDelay, duration: 1.6, ease }}
            className="relative mx-auto w-full max-w-[660px] lg:mr-0"
          >
            <div className="absolute -inset-5 rounded-[50%] bg-blush/10 blur-3xl" />
            <div className="relative aspect-[0.82] overflow-hidden rounded-[4px] bg-clay shadow-2xl shadow-black/50 md:aspect-[0.84]">
              {/* Slow cinematic zoom + parallax */}
              <motion.div
                style={{ x: imgX, y: imgY }}
                className="absolute inset-0"
              >
                <motion.img
                  src={birthday.heroImage}
                  alt="Portrait of the birthday celebrant in warm sunlight"
                  animate={reduceMotion ? undefined : { scale: [1, 1.04, 1] }}
                  transition={
                    reduceMotion
                      ? undefined
                      : { duration: 18, repeat: Infinity, ease: "easeInOut" }
                  }
                  className="h-full w-full object-cover object-center saturate-[0.75]"
                />
              </motion.div>
              <div className="absolute inset-0 bg-gradient-to-t from-ink/30 via-transparent to-white/5" />
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between border-t border-white/30 pt-3 text-[9px] uppercase tracking-[0.25em] text-white/80">
                <span>For {birthday.celebrantName}</span>
                <span>{birthday.year}</span>
              </div>
              <MemorySticker stickerIndex={0} positionClass="top-4 right-4" />
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: isLoading ? 0 : 1,
                scale: isLoading ? 0.8 : 1,
              }}
              transition={{ delay: imgDelay + 0.8, duration: 0.8, ease }}
              className="absolute -bottom-7 -left-6 hidden h-24 w-24 rounded-full border border-blush/50 bg-ink/80 p-2 sm:block"
            >
              <div className="flex h-full items-center justify-center rounded-full border border-white/10 text-center font-serif text-[11px] italic leading-3 text-blush transition-colors duration-500 hover:text-ivory">
                Made
                <br />
                By Amorth
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0 : 1 }}
          transition={{ delay: btnDelay + 0.6, duration: 1, ease }}
          className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 items-center gap-3 text-[9px] uppercase tracking-[0.24em] text-sand/50 md:flex"
        >
          <motion.span
            animate={reduceMotion ? undefined : { scaleY: [0.3, 1, 0.3] }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
            }
            style={{ transformOrigin: "top" }}
            className="h-8 w-px bg-sand/30"
          />
          Scroll to wander
        </motion.div>
      </section>

      {/* Memories Gallery */}
      <section
        id="memories"
        className="border-t border-white/10 bg-[#231b19] px-6 py-28 md:px-10 md:py-40 lg:px-16"
      >
        <div className="mx-auto max-w-[1320px]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1, ease }}
            className="mb-20 flex flex-col justify-between gap-8 md:flex-row md:items-end"
          >
            <div>
              <p className="mb-5 text-[10px] uppercase tracking-[0.35em] text-blush">
                The archive
              </p>
              <h2 className="max-w-2xl font-sans text-[clamp(3.4rem,7vw,7.5rem)] font-light leading-[0.88] tracking-[-0.07em]">
                Your
                <br />
                <span className="font-serif italic text-sand">memories.</span>
              </h2>
            </div>
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.8, ease }}
              className="max-w-[220px] border-l border-white/20 pl-4 text-xs leading-6 text-sand/60"
            >
              Every picture has a story. Here are a few of my favorite chapters.
            </motion.p>
          </motion.div>
          <div className="grid grid-cols-1 gap-x-5 gap-y-16 sm:grid-cols-2 lg:grid-cols-12">
            {photos.map((photo, index) => (
              <GalleryCard
                key={photo.id}
                photo={photo}
                index={index}
                onClick={() => setSelectedIndex(index)}
              />
            ))}
          </div>
          {photos.length === birthday.memories.length && (
            <p className="mt-20 text-center font-serif text-lg italic text-sand/45">
              The best memories are still being made.
            </p>
          )}
        </div>
      </section>

      {/* Photo Album */}
      <PhotoAlbumSection canEdit={isCelebrant} />

      {/* Add Photo — private to the celebrant */}
      {isCelebrant && (
        <section id="add" className="px-6 py-28 md:px-10 md:py-40 lg:px-16">
        <div className="mx-auto max-w-[1100px]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1, ease }}
            className="mb-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
          >
            <div>
              <p className="mb-5 text-[10px] uppercase tracking-[0.35em] text-blush">
                Keep adding to it
              </p>
              <h2 className="font-sans text-[clamp(3rem,6vw,6.5rem)] font-light leading-[0.88] tracking-[-0.07em]">
                Your story
                <br />
                <span className="font-serif italic text-sand">
                  doesn&rsquo;t end here.
                </span>
              </h2>
            </div>
            <p className="max-w-[220px] text-sm leading-6 text-sand/60 md:pb-1">
              Bring your favorite moments into this little corner of the
              internet.
            </p>
          </motion.div>

          {/* Sticker picker */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.8, ease }}
            className="mb-6 rounded-[4px] border border-white/10 bg-white/[0.025] p-5"
          >
            <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-sand/60">
              <Sparkles size={13} className="text-blush" />
              Pick a character sticker for your photos
            </div>
            <div className="flex flex-wrap gap-3">
              {stickerDesigns.map((Sticker, i) => (
                <motion.button
                  key={`builtin-${i}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ delay: i * 0.05, duration: 0.4, ease }}
                  whileHover={{ scale: 1.1 }}
                  onClick={() => setSelectedSticker(i)}
                  className={`relative h-16 w-16 rounded-full border-2 p-1 transition-all duration-300 ${
                    selectedSticker === i
                      ? "border-blush bg-blush/20 scale-110"
                      : "border-white/20 bg-ivory/95 hover:border-white/50"
                  }`}
                  aria-label={`Sticker ${i + 1}`}
                >
                  <Sticker />
                  {selectedSticker === i && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blush text-ink">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </motion.button>
              ))}
              {customStickers.map((sticker, i) => {
                const absoluteIndex = stickerDesigns.length + i;
                return (
                  <div key={sticker.id} className="relative">
                    <button
                      onClick={() => setSelectedSticker(absoluteIndex)}
                      className={`relative h-16 w-16 rounded-full border-2 p-1 transition-all duration-300 ${
                        selectedSticker === absoluteIndex
                          ? "border-blush bg-blush/20 scale-110"
                          : "border-white/20 bg-ivory/95 hover:border-white/50"
                      }`}
                      aria-label={`Custom sticker ${i + 1}`}
                    >
                      <img
                        src={sticker.src}
                        alt={`Custom sticker ${i + 1}`}
                        className="h-full w-full rounded-full object-cover"
                      />
                      {selectedSticker === absoluteIndex && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blush text-ink">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCustomSticker(sticker.id, absoluteIndex);
                      }}
                      className="absolute -right-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#5a3d35] text-ivory transition hover:bg-[#c44040]"
                      aria-label="Delete sticker"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                );
              })}
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{
                  delay: stickerDesigns.length * 0.05,
                  duration: 0.4,
                  ease,
                }}
                whileHover={{ scale: 1.1 }}
                onClick={() => stickerInputRef.current?.click()}
                className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-full border-2 border-dashed border-white/25 text-sand/50 transition-all duration-300 hover:border-blush hover:text-blush"
                aria-label="Upload custom sticker"
              >
                <ImagePlus size={18} />
                <span className="text-[7px] uppercase tracking-[0.1em]">
                  Upload
                </span>
              </motion.button>
              <input
                ref={stickerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(e) => void handleStickerUpload(e)}
                className="hidden"
              />
            </div>
            <p className="mt-3 text-[10px] text-sand/40">
              Pick a built-in character or upload your own sticker image. It
              will be placed on every photo you upload.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: 0.1, duration: 0.8, ease }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[4px] border border-dashed border-white/25 bg-white/[0.025] px-6 text-center transition-all duration-400 hover:border-blush/80 hover:bg-blush/[0.04]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              onChange={onFileChange}
              className="hidden"
            />
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 transition-transform duration-400 group-hover:scale-110 group-hover:border-blush">
              <Plus size={20} strokeWidth={1} />
            </div>
            <motion.h3
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6, ease }}
              className="font-serif text-2xl italic text-ivory"
            >
              Add photos
            </motion.h3>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6, ease }}
              className="mt-2 text-xs text-sand/55"
            >
              Drop your memories here &middot; JPG, PNG, WEBP
            </motion.p>
          </motion.div>
          {pendingFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="mt-6 flex flex-col gap-4 rounded-[4px] border border-white/10 bg-white/[0.03] p-5 md:flex-row md:items-center md:justify-between"
            >
              <div className="max-h-36 w-full space-y-2 overflow-y-auto md:max-w-xs">
                {pendingFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-sm border border-white/10 bg-ink/30 px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-xs text-sand/75">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingFile(index)}
                      className="shrink-0 rounded-full p-1 text-sand/60 transition-colors hover:bg-white/10 hover:text-ivory"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full border border-white/20 bg-ivory/95 p-0.5">
                  <div className="h-full w-full">
                    {selectedSticker < stickerDesigns.length
                      ? (() => {
                          const S = stickerDesigns[selectedSticker];
                          return <S />;
                        })()
                      : (() => {
                          const cs =
                            customStickers[
                              selectedSticker - stickerDesigns.length
                            ];
                          return cs ? (
                            <img
                              src={cs.src}
                              alt="Selected sticker"
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : null;
                        })()}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-ivory">
                    {pendingFiles.length} photo
                    {pendingFiles.length > 1 ? "s" : ""} ready to keep
                  </p>
                  <p className="mt-1 text-xs text-sand/50">
                    They&rsquo;ll appear in your memory archive with the
                    selected sticker.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setPendingFiles([]);
                  }}
                  className="rounded-full border border-white/20 px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-sand transition-all duration-300 hover:border-white hover:scale-[1.03]"
                >
                  Clear
                </button>
                <button
                  disabled={uploading}
                  onClick={(event) => {
                    event.stopPropagation();
                    void savePhotos();
                  }}
                  className="inline-flex items-center gap-3 rounded-full bg-ivory px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-ink transition-all duration-300 hover:bg-blush hover:scale-[1.03] disabled:opacity-60 disabled:hover:scale-100"
                >
                  <Upload
                    size={14}
                    className="transition-transform duration-300"
                  />
                  {uploadLabel}
                </button>
              </div>
            </motion.div>
          )}
          {uploaded && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease }}
              className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-blush"
            >
              <Check size={15} /> Saved beautifully. Your new memory is now in
              the archive.
            </motion.p>
          )}
          {uploadError && (
            <p className="mt-5 text-center text-xs text-blush">{uploadError}</p>
          )}
        </div>
      </section>
      )}

      {/* Letter */}
      <section
        id="letter"
        className={`relative overflow-hidden border-y border-white/10 px-6 py-28 transition-colors duration-1000 md:px-10 md:py-40 lg:px-16 ${letterOpen ? "bg-[#14100f]" : "bg-[#2b201d]"}`}
      >
        <div className="absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-blush/10 blur-[100px]" />
        <div className="relative mx-auto max-w-[900px] text-center">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease }}
            className="mb-5 text-[10px] uppercase tracking-[0.35em] text-blush"
          >
            A letter for you
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: 0.15, duration: 1, ease }}
            className="font-sans text-[clamp(3rem,6vw,6.2rem)] font-light leading-[0.9] tracking-[-0.07em]"
          >
            Some things are
            <br />
            <span className="font-serif italic text-sand">
              easier to write.
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: 0.4, duration: 0.8, ease }}
            className="mt-6 text-sm text-sand/60"
          >
            {birthday.letterIntro}
          </motion.p>

          <div className="relative mx-auto mt-16 max-w-[580px] [perspective:1800px]">
            <motion.div
              animate={{ scale: letterOpen ? 1.04 : 1 }}
              transition={{ duration: 1, ease }}
              className="relative aspect-[1.5]"
              style={{ transformStyle: "preserve-3d" }}
            >
              <AnimatePresence>
                {!letterOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="absolute -right-[5px] top-1.5 bottom-1.5 w-1.5 rounded-r-sm bg-[#c4b393] shadow-md"
                  >
                    <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-around px-0.5">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-px bg-[#a8956d]/50" />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Letter paper — slides up from envelope */}
              <motion.div
                animate={{
                  opacity: letterOpen ? 1 : 0,
                  y: letterOpen ? 0 : 40,
                }}
                transition={{
                  delay: letterOpen ? 0.6 : 0,
                  duration: 0.9,
                  ease,
                }}
                className="paper-texture absolute inset-0 overflow-y-auto rounded-[3px] bg-[#eadfcf] px-6 py-8 text-left text-[#493831] shadow-2xl shadow-black/50 md:px-10 md:py-10"
              >
                {letterOpen && (
                  <motion.div
                    initial={{ x: "-60%" }}
                    animate={{ x: "160%" }}
                    transition={{ delay: 0.9, duration: 1.4, ease }}
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-black/10 to-transparent"
                  />
                )}
                <div className="relative">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: letterOpen ? 1 : 0 }}
                    transition={{
                      delay: letterOpen ? 0.8 : 0,
                      duration: 0.5,
                      ease,
                    }}
                    className="mb-8 flex items-start justify-between border-b border-[#8d7462]/30 pb-4 text-[9px] uppercase tracking-[0.25em] text-[#806657]"
                  >
                    <span>A little note</span>
                    <span>{birthday.year}</span>
                  </motion.div>
                  <div className="font-serif text-[1.05rem] leading-[1.85] md:text-[1.1rem]">
                    {/* Line-by-line reveal */}
                    {[
                      `Happy Birthday, ${birthday.celebrantName}.`,
                      ...birthday.message.slice(1),
                    ].map((line, i) => (
                      <motion.p
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{
                          opacity: letterOpen ? 1 : 0,
                          y: letterOpen ? 0 : 8,
                        }}
                        transition={{
                          delay: letterOpen ? 1.0 + i * 0.35 : 0,
                          duration: 0.7,
                          ease,
                        }}
                        className={
                          i === 0
                            ? "mb-6 text-2xl italic md:text-3xl"
                            : i === birthday.message.length
                              ? "mt-8 text-right text-xl italic"
                              : "mb-5"
                        }
                      >
                        {i === birthday.message.length
                          ? `\u2014 ${birthday.senderName}`
                          : line}
                      </motion.p>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setLetterOpen(false)}
                  className="absolute right-3 top-3 rounded-full p-2 text-[#806657] transition hover:bg-[#806657]/10 md:right-4 md:top-4"
                  aria-label="Close letter"
                >
                  <X size={16} />
                </button>
              </motion.div>

              {/* Envelope front — opens via rotateY */}
              <motion.div
                style={{
                  transformOrigin: "left center",
                  transformStyle: "preserve-3d",
                }}
                animate={{ rotateY: letterOpen ? -178 : 0 }}
                transition={{ duration: 1.4, ease }}
                className={`absolute inset-0 ${!letterOpen ? "cursor-pointer" : ""}`}
                onClick={() => {
                  if (!letterOpen) setLetterOpen(true);
                }}
              >
                <div
                  style={{ backfaceVisibility: "hidden" }}
                  className="absolute inset-0 overflow-hidden rounded-[3px] bg-gradient-to-br from-[#5a3d35] via-[#4a322b] to-[#3d2c27] shadow-2xl shadow-black/50"
                >
                  <div className="absolute inset-0 opacity-20 paper-texture" />
                  <div className="absolute inset-3 border border-[#c4a88e]/30 rounded-[2px] md:inset-5" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-[#e8d5c0]">
                    <div className="mb-6 flex items-center gap-2 text-[8px] uppercase tracking-[0.3em] text-[#c4a88e]/70">
                      <span className="h-px w-6 bg-[#c4a88e]/40" />
                      Private
                      <span className="h-px w-6 bg-[#c4a88e]/40" />
                    </div>
                    <Heart
                      size={22}
                      className="mb-5 fill-[#c18c7d] text-[#c18c7d]"
                    />
                    <p className="font-serif text-3xl italic leading-tight md:text-4xl">
                      For you,
                      <br />
                      {birthday.celebrantName}
                    </p>
                    <div className="mt-6 h-px w-12 bg-[#c4a88e]/30" />
                    <p className="mt-4 text-[8px] uppercase tracking-[0.25em] text-[#c4a88e]/50">
                      {birthday.year}
                    </p>
                    {!letterOpen && (
                      <motion.div
                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                        transition={{
                          duration: 2.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="mt-8 flex items-center gap-2 text-[8px] uppercase tracking-[0.25em] text-[#c4a88e]/60"
                      >
                        <BookOpen size={11} />
                        Tap to open
                      </motion.div>
                    )}
                  </div>
                  <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/40 to-transparent" />
                </div>

                <div
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                  className="paper-texture absolute inset-0 overflow-hidden rounded-[3px] bg-[#d8c7b0] shadow-2xl shadow-black/50"
                >
                  <div className="absolute inset-3 border border-[#a88e74]/25 rounded-[2px] md:inset-5" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-[#8d7462]">
                    <Heart
                      size={16}
                      className="mb-4 fill-[#c4a88e]/40 text-[#c4a88e]/40"
                    />
                    <p className="font-serif text-lg italic leading-relaxed text-[#a88e74]">
                      Open your heart
                      <br />
                      to the words inside.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="relative px-6 py-36 text-center md:py-52">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(142,99,88,0.14),transparent_42%)]" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1, ease }}
          className="relative"
        >
          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto mb-8 w-fit"
          >
            <Heart size={20} className="fill-blush text-blush" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: 0.1, duration: 0.7, ease }}
            className="mb-6 text-[10px] uppercase tracking-[0.35em] text-blush"
          >
            Always, in every season
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: 0.2, duration: 0.9, ease }}
            className="font-sans text-[clamp(3.4rem,8vw,8rem)] font-light leading-[0.84] tracking-[-0.08em]"
          >
            Here&rsquo;s to another
            <br />
            <span className="font-serif italic text-sand">beautiful year.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: 0.4, duration: 0.8, ease }}
            className="mt-12 font-serif text-2xl italic text-ivory"
          >
            Happy Birthday, {birthday.celebrantName}.{" "}
            <span className="text-blush">&#9825;</span>
          </motion.p>
          <motion.a
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: 0.55, duration: 0.7, ease }}
            href="#memories"
            className="mt-14 inline-flex items-center gap-3 rounded-full border border-white/20 px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-sand transition-all duration-300 hover:border-white hover:bg-white/10 hover:scale-[1.03]"
          >
            Back to memories{" "}
            <ArrowUp
              size={14}
              className="transition-transform duration-300 hover:-translate-y-0.5"
            />
          </motion.a>
        </motion.div>
      </section>
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-20px" }}
        transition={{ duration: 1, ease }}
        className="flex flex-col justify-between gap-4 border-t border-white/10 px-6 py-8 text-[9px] uppercase tracking-[0.24em] text-sand/40 md:flex-row md:px-16"
      >
        <span>Made by Amorth</span>
        <span>
          For {birthday.celebrantName} &middot; {birthday.year}
        </span>
      </motion.footer>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedPhoto && selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-5 backdrop-blur-xl md:p-12"
            role="dialog"
            aria-modal="true"
            aria-label={selectedPhoto.title}
            onClick={() => setSelectedIndex(null)}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4, ease }}
              onClick={() => setSelectedIndex(null)}
              className="absolute right-5 top-5 rounded-full border border-white/20 p-3 text-ivory transition-all duration-300 hover:bg-white/10 hover:scale-110 md:right-10 md:top-10"
              aria-label="Close photo"
            >
              <X size={18} />
            </motion.button>
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.4, ease }}
              onClick={(event) => {
                event.stopPropagation();
                movePhoto(-1);
              }}
              className="absolute left-4 top-1/2 rounded-full border border-white/20 p-3 text-ivory transition-all duration-300 hover:bg-white/10 hover:scale-110 md:left-10"
              aria-label="Previous photo"
            >
              <ArrowLeft size={18} />
            </motion.button>
            <motion.div
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 16 }}
              transition={{ duration: 0.6, ease }}
              onClick={(event) => event.stopPropagation()}
              className="grid max-h-[90vh] w-full max-w-5xl items-center gap-8 md:grid-cols-[1fr_250px]"
            >
              <div
                ref={detailFrameRef}
                className="relative flex max-h-[72vh] justify-center"
              >
                <img
                  src={
                    editingPhotoId === selectedPhoto.id && replacePreview
                      ? replacePreview
                      : selectedPhoto.src
                  }
                  alt={selectedPhoto.alt}
                  className="max-h-[72vh] w-auto max-w-full rounded-[3px] object-contain transition-opacity duration-500"
                />
                <MemorySticker
                  stickerIndex={getStickerIndex(selectedPhoto)}
                  customStickerSrc={getCustomStickerSrc(selectedPhoto)}
                  positionClass={
                    editingPhotoId === selectedPhoto.id ||
                    "stickerPositionX" in selectedPhoto
                      ? undefined
                      : "top-4 right-4"
                  }
                  style={
                    editingPhotoId === selectedPhoto.id
                      ? {
                          left: `${stickerEdit.x}%`,
                          top: `${stickerEdit.y}%`,
                        }
                      : getStickerPlacement(selectedPhoto)
                  }
                  stickerScale={getStickerScale(selectedPhoto)}
                  stickerRotation={getStickerRotation(selectedPhoto)}
                  interactive={isCelebrant && editingPhotoId === selectedPhoto.id}
                  onPointerDown={handleStickerDrag}
                />
              </div>
              <div className="border-l border-white/20 pl-6">
                {isCelebrant &&
                isUploadedPhoto(selectedPhoto) &&
                editingPhotoId === selectedPhoto.id ? (
                  <div className="space-y-4">
                    <p className="text-[9px] uppercase tracking-[0.3em] text-blush">
                      Edit photo
                    </p>
                    <label className="block">
                      <span className="mb-2 block text-[9px] uppercase tracking-[0.22em] text-sand/55">
                        Date / TITLE
                      </span>
                      <input
                        value={editValues.date}
                        onChange={(event) =>
                          setEditValues((current) => ({
                            ...current,
                            date: event.target.value,
                          }))
                        }
                        className="w-full border-b border-white/20 bg-transparent px-0 py-2 text-sm text-ivory outline-none transition-colors focus:border-blush"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[9px] uppercase tracking-[0.22em] text-sand/55">
                        Title
                      </span>
                      <input
                        value={editValues.title}
                        onChange={(event) =>
                          setEditValues((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        className="w-full border-b border-white/20 bg-transparent px-0 py-2 font-serif text-2xl italic text-ivory outline-none transition-colors focus:border-blush"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[9px] uppercase tracking-[0.22em] text-sand/55">
                        Description
                      </span>
                      <textarea
                        value={editValues.caption}
                        onChange={(event) =>
                          setEditValues((current) => ({
                            ...current,
                            caption: event.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full resize-none border-b border-white/20 bg-transparent px-0 py-2 text-sm leading-6 text-sand/75 outline-none transition-colors focus:border-blush"
                      />
                    </label>
                    {getCustomStickerSrc(selectedPhoto) && (
                      <div className="space-y-3 border-t border-white/10 pt-4">
                        <p className="text-[9px] uppercase tracking-[0.22em] text-sand/55">
                          Sticker placement
                        </p>
                        <StickerRange
                          label="Horizontal"
                          value={stickerEdit.x}
                          min={12}
                          max={88}
                          step={1}
                          onChange={(value) =>
                            setStickerEdit((current) => ({
                              ...current,
                              x: value,
                            }))
                          }
                        />
                        <StickerRange
                          label="Vertical"
                          value={stickerEdit.y}
                          min={12}
                          max={88}
                          step={1}
                          onChange={(value) =>
                            setStickerEdit((current) => ({
                              ...current,
                              y: value,
                            }))
                          }
                        />
                        <StickerRange
                          label="Size"
                          value={stickerEdit.scale}
                          min={0.65}
                          max={1.5}
                          step={0.01}
                          onChange={(value) =>
                            setStickerEdit((current) => ({
                              ...current,
                              scale: value,
                            }))
                          }
                        />
                        <StickerRange
                          label="Rotation"
                          value={stickerEdit.rotation}
                          min={-12}
                          max={12}
                          step={1}
                          onChange={(value) =>
                            setStickerEdit((current) => ({
                              ...current,
                              rotation: value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setStickerEdit({
                              x: 78,
                              y: 78,
                              scale: 1,
                              rotation: -4,
                            })
                          }
                          className="text-[9px] uppercase tracking-[0.18em] text-sand/65 transition-colors hover:text-ivory"
                        >
                          Reset position
                        </button>
                      </div>
                    )}
                    <input
                      ref={replaceInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      onChange={chooseReplacement}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => replaceInputRef.current?.click()}
                      className="inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-sand/70 transition-colors hover:text-ivory"
                    >
                      <ImagePlus size={13} />
                      Replace photo
                    </button>
                    {replacePreview && (
                      <p className="text-[10px] text-blush">
                        New photo preview ready
                      </p>
                    )}
                    {!removeConfirmOpen ? (
                      <button
                        type="button"
                        onClick={() => setRemoveConfirmOpen(true)}
                        className="inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-[#b18173] transition-colors hover:text-[#d09a89]"
                      >
                        <Trash2 size={13} />
                        Remove photo
                      </button>
                    ) : (
                      <div className="border border-[#8d6255]/50 bg-[#241b18]/70 p-4">
                        <p className="font-serif text-lg italic text-ivory">
                          Remove this memory?
                        </p>
                        <p className="mt-1 text-xs leading-5 text-sand/60">
                          This photo will be removed from your gallery.
                        </p>
                        <div className="mt-4 flex gap-3">
                          <button
                            type="button"
                            onClick={() => setRemoveConfirmOpen(false)}
                            className="rounded-full border border-white/20 px-4 py-2 text-[9px] uppercase tracking-[0.18em] text-sand"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={confirmPhotoRemoval}
                            className="rounded-full bg-[#8d6255] px-4 py-2 text-[9px] uppercase tracking-[0.18em] text-ivory transition-colors hover:bg-[#a87563]"
                          >
                            Remove photo
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={cancelPhotoEdit}
                        className="rounded-full border border-white/20 px-4 py-2 text-[9px] uppercase tracking-[0.18em] text-sand"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => void savePhotoChanges()}
                        className="rounded-full bg-ivory px-4 py-2 text-[9px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-blush disabled:opacity-60"
                      >
                        {savingEdit ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mb-4 text-[9px] uppercase tracking-[0.3em] text-blush">
                      {selectedPhoto.date}
                    </p>
                    <h3 className="font-serif text-3xl italic text-ivory">
                      {selectedPhoto.title}
                    </h3>
                    <p className="mt-5 text-sm leading-7 text-sand/65">
                      {selectedPhoto.caption}
                    </p>
                    <p className="mt-12 text-[9px] uppercase tracking-[0.24em] text-sand/40">
                      {String(selectedIndex + 1).padStart(2, "0")} /{" "}
                      {String(photos.length).padStart(2, "0")}
                    </p>
                    {isCelebrant && isUploadedPhoto(selectedPhoto) && (
                      <button
                        type="button"
                        onClick={() => beginPhotoEdit(selectedPhoto)}
                        className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-[9px] uppercase tracking-[0.2em] text-sand transition-colors hover:border-blush hover:text-ivory"
                      >
                        Edit photo
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.4, ease }}
              onClick={(event) => {
                event.stopPropagation();
                movePhoto(1);
              }}
              className="absolute right-4 top-1/2 rounded-full border border-white/20 p-3 text-ivory transition-all duration-300 hover:bg-white/10 hover:scale-110 md:right-10"
              aria-label="Next photo"
            >
              <ArrowRight size={18} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function LoadingScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink"
    >
      <div className="text-center">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto mb-5 w-fit"
        >
          <Heart size={17} className="fill-blush text-blush" />
        </motion.div>
        <p className="font-serif text-2xl italic text-ivory">
          Something special is waiting for you.
        </p>
        <div className="mx-auto mt-6 h-px w-24 overflow-hidden bg-white/15">
          <motion.div
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="h-full w-full bg-blush"
          />
        </div>
      </div>
    </motion.div>
  );
}

/* Navigation link with growing underline. Uses the shared scroll handler so
   tablets/iPads (which see the desktop bar) behave identically to mobile. */
function NavLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate?: (event: { preventDefault: () => void }, href: string) => void;
}) {
  return (
    <a
      href={href}
      onClick={onNavigate ? (event) => onNavigate(event, href) : undefined}
      className="group relative py-2 transition-colors duration-300 hover:text-ivory"
    >
      <span className="transition-[letter-spacing] duration-300 group-hover:tracking-[0.32em]">
        {label}
      </span>
      <span className="absolute bottom-0 left-0 h-px w-0 bg-ivory transition-all duration-400 ease-out group-hover:w-full" />
    </a>
  );
}

function StickerRange({
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
      <span className="w-20 shrink-0">{label}</span>
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

/* Gallery card with editorial reveal + hover zoom/darken/caption */
function GalleryCard({
  photo,
  index,
  onClick,
}: {
  photo: GalleryPhoto;
  index: number;
  onClick: () => void;
}) {
  const colSpan =
    photo.layout === "feature"
      ? "sm:col-span-2 lg:col-span-7"
      : photo.layout === "wide"
        ? "sm:col-span-2 lg:col-span-5"
        : photo.layout === "tall"
          ? "lg:col-span-3"
          : "lg:col-span-4";
  const aspect =
    photo.layout === "feature"
      ? "aspect-[1.12]"
      : photo.layout === "wide"
        ? "aspect-[1.5]"
        : photo.layout === "tall"
          ? "aspect-[0.72]"
          : "aspect-square";
  const stickerIndex = getStickerIndex(photo);
  const customStickerSrc = getCustomStickerSrc(photo);
  return (
    <motion.button
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      whileHover="hover"
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: (index % 3) * 0.1, duration: 0.9, ease }}
      onClick={onClick}
      className={`group text-left ${colSpan}`}
    >
      <div
        className={`relative ${aspect} overflow-hidden rounded-[3px] bg-clay`}
      >
        <img
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          className="h-full w-full object-cover saturate-[0.72] transition-all duration-1000 ease-out group-hover:scale-[1.06] group-hover:saturate-100"
        />
        {/* Darken on hover */}
        <div className="absolute inset-0 bg-ink/0 transition-colors duration-500 group-hover:bg-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-70" />
        <MemorySticker
          stickerIndex={stickerIndex}
          customStickerSrc={customStickerSrc}
          style={getStickerPlacement(photo)}
          stickerScale={getStickerScale(photo)}
          stickerRotation={getStickerRotation(photo)}
        />
        {/* Caption/date — reveals on hover */}
        <div className="absolute bottom-0 left-0 right-0 translate-y-2 p-5 opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/70">
            {photo.date}
          </p>
          <p className="mt-1 font-serif text-lg italic text-white/95">
            {photo.title}
          </p>
          <p className="mt-1 max-w-[18rem] text-xs leading-5 text-white/70">
            {photo.caption}
          </p>
        </div>
        <span className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-white opacity-0 transition-opacity duration-400 group-hover:opacity-100">
          <ArrowRight size={14} />
        </span>
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl italic text-ivory">
            {photo.title}
          </h3>
          <p className="mt-1 max-w-[260px] text-xs leading-5 text-sand/55">
            {photo.caption}
          </p>
        </div>
        <span className="pt-1 text-[9px] uppercase tracking-[0.2em] text-sand/45">
          {photo.date}
        </span>
      </div>
    </motion.button>
  );
}

