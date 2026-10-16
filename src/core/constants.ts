// constants.ts — fixed numbers of the duel: money, hand size, difficulty levels, answer keys.
import type { Diff, DiffKey } from './types';

export const LP_MAX = 10000;
export const HAND_SIZE = 5;
export const DECK_SIZE = 40;
export const DECK_COPY = 2;

export const DIFFS: Record<DiffKey, Diff> = {
  easy: { key: 'easy', name: '簡易', time: 30, fast: 12, foeMult: 1.0 },
  normal: { key: 'normal', name: '適中', time: 20, fast: 9, foeMult: 1.15 },
  hard: { key: 'hard', name: '困難', time: 10, fast: 6, foeMult: 1.3 },
};
export const DIFF_ORDER: DiffKey[] = ['easy', 'normal', 'hard'];

/** labels for the answer options (keyboard 1–6) */
export const KEYS = ['甲', '乙', '丙', '丁', '戊', '己'];

/** question levels */
export const DIFF_LABEL: Record<number, string> = { 1: '初階', 2: '中階', 3: '進階' };

export function shuffle<T>(a: T[], rnd: () => number = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
