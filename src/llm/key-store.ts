// Where an LLM key lives (llm-adapter Req 4.1 to 4.3, design.md "Key storage"). By default a key
// is held in memory, in this module only, so it is gone when the tab closes. Only when the user
// ticks "remember this key on this device" is it also written to localStorage, under
// "stitchform.llm.<provider>.key", and "forget key" removes it from both. Nothing here logs or
// throws. The stitch-code and PDF modules have no import path to this file (a test checks), so
// a key cannot reach a stitch code or a PDF.

import type { ProviderId } from './types';

export type KeyProvider = Exclude<ProviderId, 'none'>;

const memory = new Map<KeyProvider, string>();

/** The localStorage entry for `provider`'s key. */
export const storageKey = (provider: KeyProvider): string => `stitchform.llm.${provider}.key`;

/**
 * This page's localStorage, or null where there is none (outside a browser) or access is
 * refused, which throws a SecurityError when the user blocks site data (MDN Window.localStorage).
 */
function deviceStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStored(provider: KeyProvider): string | null {
  try {
    const value = deviceStorage()?.getItem(storageKey(provider));
    return typeof value === 'string' && value !== '' ? value : null;
  } catch {
    return null;
  }
}

function removeStored(provider: KeyProvider): void {
  try {
    deviceStorage()?.removeItem(storageKey(provider));
  } catch {
    // Nothing to do: storage that cannot be reached holds nothing this page can read back.
  }
}

/** The key for `provider`: the one held in memory, else one remembered on this device. */
export function getKey(provider: KeyProvider): string | undefined {
  return memory.get(provider) ?? readStored(provider) ?? undefined;
}

/**
 * Whether a key for `provider` is stored on this device, so the settings panel shows the box
 * ticked, the warning that any script on the page could read it, and "forget key" (Req 4.2).
 */
export function isRemembered(provider: KeyProvider): boolean {
  return readStored(provider) !== null;
}

/**
 * Hold `key` for `provider` (Req 4.1). With `remember` it is also written to this device's
 * storage (Req 4.2); without it any stored copy is removed, so unticking the box takes the key
 * off the device. The key is trimmed, and a blank key forgets the provider's key. Returns
 * whether the key is now stored on the device: false when not asked to, or when storage is
 * missing, refused or full (QuotaExceededError), in which case any older stored copy is removed
 * and the key stays in memory only.
 */
export function setKey(provider: KeyProvider, key: string, remember: boolean): boolean {
  const trimmed = key.trim();
  if (trimmed === '') {
    forgetKey(provider);
    return false;
  }
  memory.set(provider, trimmed);
  if (remember) {
    const storage = deviceStorage();
    try {
      if (storage !== null) {
        storage.setItem(storageKey(provider), trimmed);
        return true;
      }
    } catch {
      // Refused or full: fall through and make sure no older key is left behind.
    }
  }
  removeStored(provider);
  return false;
}

/** "Forget key": remove `provider`'s key from memory and from this device's storage (Req 4.2). */
export function forgetKey(provider: KeyProvider): void {
  memory.delete(provider);
  removeStored(provider);
}
