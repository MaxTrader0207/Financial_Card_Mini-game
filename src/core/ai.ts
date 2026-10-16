// ai.ts — the opponent's attack choice: expected damage against our hand, type advantage and our weak attributes,
// with more randomness on easier levels.
import { MON } from './cards';
import { LP_MAX } from './constants';
import { foeAtkOf } from './calc';
import { G } from './game';
import { catAccEst } from './records';
import { advOf } from './rules';
import { SKILLS } from './skills';
import type { Card } from './types';

/** chance the opponent plays its best-scored card */
export const AI_SENSE = { easy: 0.6, normal: 0.7, hard: 0.9 };

export function cpuScore(m: Card): number {
  const atk = foeAtkOf(m), lpP = G.lp.p, lpC = G.lp.c;
  const defs = G.hand.p.map(i => MON[i.id]);
  const bestDef = defs.length ? Math.max(...defs.map(d => d.def * advOf(d.cat, m.cat))) : 0;
  const acc = G.diff.key === 'easy' ? 0.7 : catAccEst(m.cat);
  let ev = (1 - acc) * atk + acc * (Math.max(0, atk - bestDef) - Math.max(0, bestDef - atk));
  if (SKILLS[m.id].hit) ev += (1 - acc) * 200;
  if (atk >= lpP) ev += (1 - acc) * 4000;                   // a wrong answer would finish the duel
  else if (lpP < LP_MAX * 0.35) ev += atk * 0.5;            // press when the player is low
  const others = G.hand.c.some(x => MON[x.id].rank < 4);
  if (m.rank === 4 && others && lpP > LP_MAX * 0.6 && lpC > LP_MAX * 0.4) ev -= 700;   // hold the ace for later
  return ev;
}

export function cpuPick(rnd: () => number = Math.random): number {
  const hand = G.hand.c;
  const scores = hand.map(i => cpuScore(MON[i.id]));
  let idx: number;
  if (rnd() < AI_SENSE[G.diff.key]) idx = scores.indexOf(Math.max(...scores));
  else {
    const w = hand.map(i => MON[i.id].atk + 400);
    let r = rnd() * w.reduce((a, b) => a + b, 0); idx = 0;
    while (r > w[idx]) { r -= w[idx]; idx++; }
  }
  return Math.min(idx, hand.length - 1);
}
