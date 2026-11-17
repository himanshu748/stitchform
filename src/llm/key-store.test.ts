// Tests for the LLM key store (llm-adapter Req 4.1 to 4.3). Vitest runs in Node, which has no
// localStorage, so each test installs a fake Storage on globalThis (or none, or one that refuses
// access or is full). A tab closing is modelled by loading a fresh copy of the module. Keys are
// SAMPLE / DEMO DATA.

import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetKey, getKey, isRemembered, setKey, storageKey, type KeyProvider } from './key-store';

const KEY = 'wk-demo.ws-demo';
const PROVIDERS: KeyProvider[] = ['modal', 'ollama', 'gemini'];

/** An in-memory Storage that can also refuse writes as if full. */
class FakeStorage {
  readonly items = new Map<string, string>();
  full = false;
  readonly writes: [string, string][] = [];

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.full) throw new DOMException('demo quota', 'QuotaExceededError');
    this.writes.push([key, value]);
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

let storage: FakeStorage;

beforeEach(() => {
  storage = new FakeStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  for (const p of PROVIDERS) forgetKey(p);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A fresh copy of the module, as after the tab is closed and the page opened again. */
async function reopenedTab(): Promise<typeof import('./key-store')> {
  vi.resetModules();
  return import('./key-store');
}

describe('memory by default (Req 4.1)', () => {
  it('holds the key in memory only, so it is gone when the tab closes', async () => {
    expect(setKey('modal', KEY, false)).toBe(false);
    expect(getKey('modal')).toBe(KEY);
    expect(isRemembered('modal')).toBe(false);
    expect(storage.writes).toEqual([]);
    expect(storage.items.size).toBe(0);
    expect((await reopenedTab()).getKey('modal')).toBeUndefined();
  });

  it('has no key before one is set, and keeps keys of different providers apart', () => {
    expect(getKey('modal')).toBeUndefined();
    setKey('modal', KEY, false);
    setKey('gemini', 'demo-gemini-key', false);
    expect([getKey('modal'), getKey('gemini'), getKey('ollama')]).toEqual([KEY, 'demo-gemini-key', undefined]);
    forgetKey('gemini');
    expect([getKey('modal'), getKey('gemini')]).toEqual([KEY, undefined]);
  });

  it('trims a pasted key, and treats a blank key as forgetting it', () => {
    setKey('modal', `  ${KEY}\n`, true);
    expect(getKey('modal')).toBe(KEY);
    expect(storage.items.get('stitchform.llm.modal.key')).toBe(KEY);
    expect(setKey('modal', '   ', true)).toBe(false);
    expect(getKey('modal')).toBeUndefined();
    expect(storage.items.size).toBe(0);
  });
});

describe('remember on this device, and forget (Req 4.2)', () => {
  it('writes localStorage["stitchform.llm.<provider>.key"] only when asked, and reads it back after the tab closes', async () => {
    expect(storageKey('modal')).toBe('stitchform.llm.modal.key');
    expect(setKey('modal', KEY, true)).toBe(true);
    expect(storage.writes).toEqual([['stitchform.llm.modal.key', KEY]]);
    expect(isRemembered('modal')).toBe(true);
    const reopened = await reopenedTab();
    expect(reopened.getKey('modal')).toBe(KEY);
    expect(reopened.isRemembered('modal')).toBe(true);
  });

  it('takes the key off the device when the box is unticked', () => {
    setKey('modal', KEY, true);
    expect(setKey('modal', KEY, false)).toBe(false);
    expect(storage.items.size).toBe(0);
    expect(getKey('modal')).toBe(KEY);
    expect(isRemembered('modal')).toBe(false);
  });

  it('"forget key" clears memory and the stored entry, and leaves other entries alone', async () => {
    storage.items.set('demo-other-entry', 'kept');
    setKey('modal', KEY, true);
    forgetKey('modal');
    expect(getKey('modal')).toBeUndefined();
    expect(isRemembered('modal')).toBe(false);
    expect([...storage.items]).toEqual([['demo-other-entry', 'kept']]);
    expect((await reopenedTab()).getKey('modal')).toBeUndefined();
  });

  it('keeps the key in memory when storage is full, and leaves no older key behind', () => {
    setKey('modal', 'wk-old.ws-old', true);
    storage.full = true;
    expect(setKey('modal', KEY, true)).toBe(false);
    expect(getKey('modal')).toBe(KEY);
    expect(isRemembered('modal')).toBe(false);
    expect(storage.items.size).toBe(0);
  });

  it('works in memory without localStorage, and when access to it is refused', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(setKey('modal', KEY, true)).toBe(false);
    expect([getKey('modal'), isRemembered('modal')]).toEqual([KEY, false]);
    forgetKey('modal');
    expect(getKey('modal')).toBeUndefined();

    vi.unstubAllGlobals();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('demo: site data blocked', 'SecurityError');
      },
    });
    try {
      expect(setKey('modal', KEY, true)).toBe(false);
      expect([getKey('modal'), isRemembered('modal')]).toEqual([KEY, false]);
      expect(() => forgetKey('modal')).not.toThrow();
      expect(getKey('modal')).toBeUndefined();
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});

describe('keys stay out of logs, stitch codes and PDFs (Req 4.3)', () => {
  it('never calls console', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    setKey('modal', KEY, true);
    getKey('modal');
    isRemembered('modal');
    storage.full = true;
    setKey('modal', KEY, true);
    forgetKey('modal');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('cannot be reached from the stitch-code or PDF modules, and only src/llm uses it', () => {
    const src = fileURLToPath(new URL('..', import.meta.url));
    const files = (readdirSync(src, { recursive: true }) as string[]).filter((f) => /\.(ts|mts|js|mjs)$/.test(f) && !/\.test\./.test(f));
    const imports = (file: string): string[] => [...readFileSync(join(src, file), 'utf8').matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? m[2] ?? '');
    let checked = 0;
    for (const file of files) {
      const path = file.split(sep).join('/');
      const specifiers = imports(file);
      if (path.startsWith('stitch-code/') || path.startsWith('pdf/')) {
        checked += 1;
        expect([path, specifiers.filter((s) => /(^|\/)llm(\/|$)/.test(s))]).toEqual([path, []]);
      }
      if (!path.startsWith('llm/')) expect([path, specifiers.filter((s) => s.includes('key-store'))]).toEqual([path, []]);
    }
    // The stitch-code module exists today; the PDF module arrives later and is checked then.
    expect(checked).toBeGreaterThan(0);
  });
});
