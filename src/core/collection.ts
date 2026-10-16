// collection.ts — owned cards, the saved 40-card deck (validation, automatic deck), victory rewards, and the opponent's
// deck per difficulty. Same storage keys and shapes as the earlier versions of the game.
import { CAT_ORDER, MON, MONSTERS } from './cards';
import { DECK_COPY, DECK_SIZE, shuffle } from './constants';
import { Store, isObj } from './store';
import type { Cat, DiffKey } from './types';

const COL_KEY = 'soba-ketto.collection.v1', DECK_KEY = 'soba-ketto.deck.v1';
const COL_V = 1, DECK_V = 2;
export const DECK_FOCUS = 12;

export interface Collection { owned: string[]; pending: string[] | null }
export let COL: Collection = { owned: [], pending: null };
export let DECK: string[] = [];

export const owns = (id: string): boolean => COL.owned.includes(id);
export const starter = (): string[] => MONSTERS.filter(m => m.rank <= 2).map(m => m.id);

export function loadCollection(): void {
  const o = Store.load<Collection>(COL_KEY, { version: COL_V, fallback: () => ({ owned: [], pending: null }), validate: d => isObj(d) && Array.isArray(d.owned) });
  o.owned = [...new Set([...starter(), ...o.owned.filter(id => MON[id])])];
  o.pending = Array.isArray(o.pending) ? o.pending.filter(id => MON[id] && !o.owned.includes(id)) : null;
  if (!o.pending || !o.pending.length) o.pending = null;
  COL = o;
  DECK = Store.load<string[]>(DECK_KEY, { version: DECK_V, fallback: () => autoDeck(), validate: deckValid as (d: unknown) => boolean,
    migrate: { 1: d => (Array.isArray(d) && d.length !== DECK_SIZE ? fitDeck(d) : d) } });
}
export function colSave(): void { Store.save(COL_KEY, COL_V, COL); }
export function setDeck(list: string[]): boolean {
  if (!deckValid(list)) return false;
  DECK = list.slice(); Store.save(DECK_KEY, DECK_V, DECK); return true;
}

export function deckValid(list: unknown): list is string[] {
  if (!Array.isArray(list) || list.length !== DECK_SIZE) return false;
  const n: Record<string, number> = {};
  for (const id of list) { if (!MON[id] || !owns(id)) return false; n[id] = (n[id] || 0) + 1; if (n[id] > DECK_COPY) return false; }
  return true;
}

/** how many cards of each attribute an automatic deck takes */
export function deckQuota(focus?: Cat | null): Record<Cat, number> {
  const power = (k: Cat) => MONSTERS.filter(m => m.cat === k && owns(m.id)).reduce((s, m) => s + m.rank * 10 + (m.atk + m.def) / 1000, 0);
  const rest = focus ? CAT_ORDER.filter(k => k !== focus) : CAT_ORDER, total = focus ? DECK_SIZE - DECK_FOCUS : DECK_SIZE;
  const base = Math.floor(total / rest.length), extra = total - base * rest.length;
  const order = rest.slice().sort((a, b) => power(b) - power(a) || CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b));
  const q = Object.fromEntries(rest.map(k => [k, base + (order.indexOf(k) < extra ? 1 : 0)])) as Record<Cat, number>;
  if (focus) q[focus] = DECK_FOCUS;
  return q;
}
/** a balanced deck from what you own (or focused on one attribute): strongest first, then second copies */
export function autoDeck(focus?: Cat | null): string[] {
  const out: string[] = [], quota = deckQuota(focus);
  for (const k of CAT_ORDER) {
    const want = quota[k] || 0;
    const kinds = MONSTERS.filter(m => m.cat === k && owns(m.id)).sort((a, b) => b.rank - a.rank || (b.atk + b.def) - (a.atk + a.def));
    const picked: string[] = [];
    for (let copy = 0; copy < DECK_COPY && picked.length < want; copy++) for (const m of kinds) { if (picked.length >= want) break; picked.push(m.id); }
    out.push(...picked);
  }
  return out;
}
/** top up (or trim) a deck to DECK_SIZE: keep what is valid, then fill with the auto-deck's picks */
export function fitDeck(list: string[]): string[] {
  const cnt: Record<string, number> = {}, keep: string[] = [];
  const add = (id: string) => { if (keep.length < DECK_SIZE && MON[id] && owns(id) && (cnt[id] || 0) < DECK_COPY) { keep.push(id); cnt[id] = (cnt[id] || 0) + 1; } };
  list.forEach(add); autoDeck().forEach(add); MONSTERS.forEach(m => { add(m.id); add(m.id); });
  return keep;
}
export const playDeck = (): string[] => (deckValid(DECK) ? DECK.slice() : autoDeck());

/** the opponent keeps pace with your collection: every 6 super/ultra rares you own upgrade one of its cards (max 10) */
const CPU_GROW_PER = 6, CPU_GROW_MAX = 10;
export const CPU_MIX: Record<DiffKey, [number, number, number]> = { easy: [32, 6, 2], normal: [30, 7, 3], hard: [24, 10, 6] };
export function cpuGrowth(): number { return Math.min(CPU_GROW_MAX, Math.floor(COL.owned.filter(id => MON[id] && MON[id].rank >= 3).length / CPU_GROW_PER)); }
export function cpuDeckList(dk: DiffKey): string[] {
  const ids = (f: (m: (typeof MONSTERS)[number]) => boolean) => shuffle(MONSTERS.filter(f).map(m => m.id));
  let [lo, sr, ur] = CPU_MIX[dk];
  const g = Math.min(cpuGrowth(), lo); lo -= g; sr += Math.ceil(g / 2); ur += Math.floor(g / 2);
  return [...ids(m => m.rank <= 2).slice(0, lo), ...ids(m => m.rank === 3).slice(0, sr), ...ids(m => m.rank === 4).slice(0, ur)];
}

/** win reward: choose 1 of up to 3 uncollected cards; hard always offers an UR while any are left */
export function rewardOffer(dk: DiffKey, rnd: () => number = Math.random): string[] | null {
  const locked = MONSTERS.filter(m => !owns(m.id));
  if (!locked.length) return null;
  const urW = { easy: 0.25, normal: 0.4, hard: 0.6 }[dk];
  const pool = locked.slice(), out: typeof MONSTERS = [];
  if (dk === 'hard') { const urs = pool.filter(m => m.rank === 4); if (urs.length) { const u = urs[Math.floor(rnd() * urs.length)]; out.push(u); pool.splice(pool.indexOf(u), 1); } }
  while (out.length < 3 && pool.length) {
    const w = pool.map(m => (m.rank === 4 ? urW : 1));
    let r = rnd() * w.reduce((a, b) => a + b, 0), i = 0;
    while (r > w[i]) { r -= w[i]; i++; }
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
  }
  return shuffle(out).map(m => m.id);
}
export function claimReward(id: string): boolean {
  if (!COL.pending || !COL.pending.includes(id)) return false;
  COL.owned.push(id); COL.pending = null; colSave(); return true;
}
