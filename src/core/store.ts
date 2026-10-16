// store.ts — versioned localStorage, compatible with the earlier versions of the game (same keys, same meta record),
// so a player's collection, deck and learning record carry over on the same site.
// On load, data older than the current version runs through the migration chain; data that cannot be read is copied
// to "<key>.backup" before the default is used, so nothing is silently lost.

export const META_KEY = 'soba-ketto.meta';

export interface Spec<T> {
  version: number;
  fallback: () => T;
  migrate?: Record<number, (d: any) => any>;
  validate?: (d: unknown) => boolean;
}

const mem = new Map<string, string>();          // used when localStorage is unavailable (tests, private mode)
const ls = {
  get(k: string): string | null { try { return globalThis.localStorage ? localStorage.getItem(k) : mem.get(k) ?? null; } catch { return mem.get(k) ?? null; } },
  set(k: string, v: string): void { try { if (globalThis.localStorage) localStorage.setItem(k, v); else mem.set(k, v); } catch { mem.set(k, v); } },
};

let meta: Record<string, number> = (() => { try { const o = JSON.parse(ls.get(META_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } })();
const writeMeta = () => ls.set(META_KEY, JSON.stringify(meta));

export const Store = {
  load<T>(key: string, spec: Spec<T>): T {
    const raw = ls.get(key);
    if (raw == null) return spec.fallback();
    let data: any;
    try { data = JSON.parse(raw); } catch { ls.set(key + '.backup', raw); return spec.fallback(); }
    let v = Number(meta[key] ?? 0);
    if (v > spec.version) { ls.set(key + '.backup', raw); return spec.fallback(); }
    const from = v;
    try { while (v < spec.version) { const f = spec.migrate?.[v]; if (f) data = f(data); v++; } }
    catch { ls.set(key + '.backup', raw); return spec.fallback(); }
    if (spec.validate && !spec.validate(data)) { ls.set(key + '.backup', raw); return spec.fallback(); }
    if (from !== v) { meta[key] = v; writeMeta(); ls.set(key, JSON.stringify(data)); }
    return data as T;
  },
  save(key: string, version: number, data: unknown): void {
    ls.set(key, typeof data === 'string' ? data : JSON.stringify(data));
    if (meta[key] !== version) { meta[key] = version; writeMeta(); }
  },
  getRaw: (k: string) => ls.get(k),
  setRaw: (k: string, v: string) => ls.set(k, v),
  /** tests: start from an empty store */
  reset(): void { mem.clear(); meta = {}; },
};

export const isObj = (o: unknown): o is Record<string, any> => !!o && typeof o === 'object' && !Array.isArray(o);
