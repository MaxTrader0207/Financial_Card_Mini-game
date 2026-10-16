// records.ts — the learning record: every finished duel, per-question history, lifetime accuracy per attribute and the
// weak attribute. Same storage keys and shapes as the earlier versions of the game.
import { CAT_ORDER } from './cards';
import { G } from './game';
import { Store, isObj } from './store';
import type { Cat } from './types';

export const REC_KEY = 'soba-ketto.records.v1', QS_KEY = 'soba-ketto.qstats.v1';
const REC_V = 1, QS_V = 1, REC_MAX = 300, WEAK_MIN = 6;

export interface DuelRecord {
  at: number; mode: string; diff: string; win: boolean; quit: boolean; turns: number; total: number; correct: number;
  byCat: Partial<Record<Cat, { t: number; c: number }>>; dealt: number; taken: number; maxStreak: number;
}
export interface QStat { t: number; w: number; last?: number }

export let RECS: DuelRecord[] = [];
export let QS: Record<string, QStat> = {};

export function loadRecords(): void {
  RECS = Store.load<DuelRecord[]>(REC_KEY, { version: REC_V, fallback: () => [], validate: Array.isArray });
  QS = Store.load<Record<string, QStat>>(QS_KEY, { version: QS_V, fallback: () => ({}), validate: isObj });
}
function save(): void { Store.save(REC_KEY, REC_V, RECS); Store.save(QS_KEY, QS_V, QS); }

export function qsRecord(qid: string, correct: boolean): void {
  const e = QS[qid] || (QS[qid] = { t: 0, w: 0 }); e.t++; if (!correct) e.w++; e.last = Date.now(); save();
}
export function recordGame(quit: boolean): void {
  if (!G || G.recorded || !G.stats.total) return;
  G.recorded = true;
  RECS.push({ at: Date.now(), mode: G.mode, diff: G.diff.key, win: !quit && !!G.win, quit, turns: G.turn, total: G.stats.total, correct: G.stats.correct,
    byCat: JSON.parse(JSON.stringify(G.stats.byCat)), dealt: G.dealt, taken: G.taken, maxStreak: G.maxStreak });
  if (RECS.length > REC_MAX) RECS = RECS.slice(-REC_MAX);
  save();
}
/** lifetime answers per attribute, including the duel in progress */
export function lifetimeByCat(): Record<Cat, { t: number; c: number }> {
  const out = Object.fromEntries(CAT_ORDER.map(k => [k, { t: 0, c: 0 }])) as Record<Cat, { t: number; c: number }>;
  const add = (b: DuelRecord['byCat']) => Object.entries(b || {}).forEach(([k, v]) => { const o = out[k as Cat]; if (o && v) { o.t += v.t; o.c += v.c; } });
  RECS.forEach(r => add(r.byCat));
  if (G && !G.recorded && !G.over) add(G.stats.byCat);
  return out;
}
/** the attribute with the lowest lifetime accuracy (needs WEAK_MIN answers, and only counts if below 85%) */
export function weakCat(): Cat | null {
  const b = lifetimeByCat();
  const cand = CAT_ORDER.filter(k => b[k].t >= WEAK_MIN).sort((x, y) => b[x].c / b[x].t - b[y].c / b[y].t);
  if (!cand.length) return null;
  const k = cand[0]; return b[k].c / b[k].t < 0.85 ? k : null;
}
/** the opponent's estimate of the player's accuracy in an attribute (smoothed toward 70%) */
export function catAccEst(cat: Cat): number { const b = lifetimeByCat()[cat]; return (b.c + 3.5) / (b.t + 5); }
