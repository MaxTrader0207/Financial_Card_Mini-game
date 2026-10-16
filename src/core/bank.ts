// bank.ts — the question bank and choosing questions: by attribute and card rank, never repeated within a duel, and
// across duels the ones asked least and longest ago first.
import { G } from './game';
import { QS, type QStat } from './records';
import type { Cat, Question } from './types';

export let BANK: Question[] = [];
export function initBank(qs: Question[]): void {
  BANK = qs.filter(q => q && q.id && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);
}

/** the question levels a card of this rank asks */
const LEVELS: Record<number, number[]> = { 1: [1], 2: [1, 2], 3: [2], 4: [3, 2] };

export function pickQuestion(cat: Cat, rank: number, rnd: () => number = Math.random): Question {
  const pool = BANK.filter(q => q.category === cat);
  const src = pool.length ? pool : BANK;
  const pref = G.tutorial || G.newbie ? [1] : LEVELS[rank] || [1, 2, 3];
  let cand = src.filter(q => pref.includes(q.difficulty) && !G.used.has(q.id));
  if (!cand.length) cand = src.filter(q => !G.used.has(q.id));
  if (!cand.length) { src.forEach(q => G.used.delete(q.id)); cand = src.slice(); }
  const q = freshPick(cand, QS, rnd);
  G.used.add(q.id);
  return q;
}

/** the opponent's block question: same attribute and level rule; marked used so we are not asked it later */
export function foeQuestion(cat: Cat, rank: number, rnd: () => number = Math.random): Question | null {
  const src = BANK.filter(q => q.category === cat);
  const pool = src.length ? src : BANK;
  if (!pool.length) return null;
  const pref = LEVELS[rank] || [1, 2, 3];
  let cand = pool.filter(q => pref.includes(q.difficulty) && !G.used.has(q.id));
  if (!cand.length) cand = pool.filter(q => !G.used.has(q.id));
  if (!cand.length) cand = pool;
  const q = cand[Math.floor(rnd() * cand.length)];
  G.used.add(q.id); return q;
}

/** prefer questions never asked; once all have been seen, the ones seen least and longest ago */
export function freshPick(cand: Question[], qs: Record<string, QStat> = {}, rnd: () => number = Math.random): Question {
  const seen = (q: Question) => qs[q.id]?.t || 0, last = (q: Question) => qs[q.id]?.last || 0;
  const minT = Math.min(...cand.map(seen));
  let pool = cand.filter(q => seen(q) === minT);
  if (minT > 0 && pool.length > 3) pool = pool.sort((a, b) => last(a) - last(b)).slice(0, Math.max(3, Math.ceil(pool.length * 0.3)));
  return pool[Math.floor(rnd() * pool.length)];
}
