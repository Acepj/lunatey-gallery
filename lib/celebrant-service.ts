import { birthday } from "@/data/birthday";

/**
 * The celebrant's private unlock.
 *
 * The passphrase itself lives in `data/birthday.ts`; once entered correctly it
 * is remembered on this device only (localStorage), so the celebrant stays
 * unlocked across visits — days, months, or years later — while every other
 * visitor only ever sees the photographs that ship with the site.
 */

const celebrantKey = "birthday-celebrant-unlocked";
const passphraseKey = "birthday-celebrant-passphrase";
const hintKey = "birthday-celebrant-hint";

export function isCelebrantUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(celebrantKey) === "true";
  } catch {
    return false;
  }
}

export function setCelebrantUnlocked(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(celebrantKey, "true");
    } else {
      window.localStorage.removeItem(celebrantKey);
    }
  } catch {
    // Private mode or blocked storage — the unlock simply won't persist.
  }
}

/**
 * The celebrant can change her key from the "Unlocked" button. A custom key
 * is remembered on her device only; until then the default from
 * `data/birthday.ts` is used.
 */
export function getCustomPassphrase(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(passphraseKey);
  } catch {
    return null;
  }
}

export function getCurrentPassphrase(): string {
  return getCustomPassphrase() ?? birthday.celebrantPassphrase;
}

export function setCustomPassphrase(value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(passphraseKey, value);
    } else {
      window.localStorage.removeItem(passphraseKey);
    }
  } catch {
    // Storage blocked — the change won't persist, nothing breaks.
  }
}

/** A small reminder she can personalise to help her remember her key. */
export function getCurrentHint(): string {
  if (typeof window === "undefined") return birthday.celebrantHint;
  try {
    return window.localStorage.getItem(hintKey) ?? birthday.celebrantHint;
  } catch {
    return birthday.celebrantHint;
  }
}

export function setCustomHint(value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(hintKey, value);
    } else {
      window.localStorage.removeItem(hintKey);
    }
  } catch {
    // Storage blocked — the change won't persist, nothing breaks.
  }
}