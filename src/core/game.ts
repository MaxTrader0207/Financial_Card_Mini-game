// game.ts — the duel in progress. One object, G, holds everything about the current duel; every rule module reads it
// from here. Only the duel controller replaces it (setGame). This module imports only types, so anything may depend on it.
import type { Machine } from './fsm';
import type { Card, CardInst, Cat, Diff, Side } from './types';

export type Mode = 'tutorial' | 'casual';
export type Phase = 'idle' | 'attack' | 'defend' | 'busy';

export interface Mods { myAtk: number; foeAtk: number; skipFoe: boolean; skipMe: boolean }
export interface HistoryItem {
  turn: number; mode: 'attack' | 'defend'; card: string; cat: Cat; diff: number; q: string; chosen: string | null; answer: string;
  correct: boolean; time: number; timeout: boolean; explain: string; retried: boolean;
}
export interface Missed { q: string; a: string; e: string; cat: Cat }

export interface Game {
  fsm: Machine;
  diff: Diff;
  mode: Mode;
  lp: Record<Side, number>;
  deck: Record<Side, CardInst[]>;
  hand: Record<Side, CardInst[]>;
  /** the 40-card lists the decks are refilled from */
  deckList: Record<Side, string[]>;
  turn: number;
  phase: Phase;
  busy: boolean;
  /** question ids already asked this duel */
  used: Set<string>;
  streak: number;
  maxStreak: number;
  /** one-shot effects waiting to apply */
  mods: Mods;
  /** per-duel skill memory */
  flags: Record<string, unknown>;
  extraUsed: boolean;
  history: HistoryItem[];
  stats: { total: number; correct: number; byCat: Partial<Record<Cat, { t: number; c: number }>> };
  missed: Missed[];
  /** the opponent's attacking card while we defend */
  foeCard: Card | null;
  /** the opponent's good and bad attributes */
  foeProf: { strong: Cat[]; weak: Cat[] };
  /** the opponent's block answers */
  foeStats: { t: number; c: number };
  /** our weakest attribute (damage bonus) */
  weak: Cat | null;
  /** the market event in force (casual duels) */
  market: { id: string | null; since: number; seen: number } | null;
  tutorial: { foeMissLeft: number; defended: boolean } | null;
  /** 新手保護: 初階 questions only and weaker opponent blocks */
  newbie: boolean;
  dealt: number;
  taken: number;
  startedAt: number;
  endedAt: number | null;
  win: boolean | null;
  over: boolean;
  recorded?: boolean;
  /** reward cards offered after a win */
  reward?: string[] | null;
}

export let G: Game = null as unknown as Game;
export function setGame(g: Game): void { G = g; }
export const hasGame = (): boolean => !!G;

/** a duel that was replaced or ended while an async step was waiting must not keep acting */
export const stale = (g: Game): boolean => G !== g || !g || g.over;

let uidSeq = 0;
export const nextUid = (): number => ++uidSeq;
