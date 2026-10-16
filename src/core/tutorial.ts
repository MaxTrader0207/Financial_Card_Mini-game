// tutorial.ts — how the 新手場 differs from a normal duel (rules only; the duel scene shows the coach steps):
//  • fixed at 簡易 with the easy opponent deck, and the opponent starts with half the money;
//  • only 初階 questions;
//  • the opponent misses its first block, so the first right answer lands in full;
//  • at the first defence the hand always holds a card with type advantage, so 相剋 can be shown in practice.
import { MON, MONSTERS } from './cards';
import { cpuDeckList } from './collection';
import { DIFFS, LP_MAX } from './constants';
import { makeDeck } from './deck';
import { G } from './game';
import { BEATS, advOf } from './rules';
import type { Card } from './types';

export const tutorialFoeLp = (): number => LP_MAX / 2;

export function setupTutorial(): void {
  G.tutorial = { foeMissLeft: 1, defended: false };
  G.diff = DIFFS.easy;
  G.deckList.c = cpuDeckList('easy');
  G.deck.c = makeDeck(G.deckList.c);
  G.lp.c = tutorialFoeLp();
}

/** the first opponent block of the tutorial is a miss */
export function tutorialFoeMiss(): boolean {
  if (!G.tutorial || G.tutorial.foeMissLeft <= 0) return false;
  G.tutorial.foeMissLeft--; return true;
}

/** at the first defence, make sure some hand card beats the attacker; returns the uid of the card to suggest */
export function ensureAdvantage(foe: Card): number | null {
  if (!G.tutorial) return null;
  const best = () => {
    const v = G.hand.p.map(i => ({ uid: i.uid, adv: advOf(MON[i.id].cat, foe.cat), def: MON[i.id].def * advOf(MON[i.id].cat, foe.cat) }));
    const good = v.filter(x => x.adv > 1).sort((a, b) => b.def - a.def);
    return good.length ? good[0].uid : null;
  };
  let uid = best();
  if (uid == null && !G.tutorial.defended) {
    const cat = (Object.keys(BEATS) as (keyof typeof BEATS)[]).find(c => BEATS[c] === foe.cat);
    const pick = G.deckList.p.map(id => MON[id]).find(m => m && m.cat === cat)
      || MONSTERS.filter(m => m.cat === cat && m.rank <= 2).sort((a, b) => b.def - a.def)[0];
    if (pick && G.hand.p.length) {
      const low = G.hand.p.reduce((a, b, i) => (MON[b.id].def < MON[G.hand.p[a].id].def ? i : a), 0);
      G.hand.p[low] = { uid: G.hand.p[low].uid, id: pick.id };
      uid = best();
    }
  }
  G.tutorial.defended = true;
  return uid;
}

/** the card a beginner should try: attack = highest ATK (weak attribute ×1.2), defence = highest DEF × advantage */
export function suggestCard(phase: 'attack' | 'defend'): number | null {
  if (!G || !G.hand.p.length) return null;
  const score = (id: string) => {
    const m = MON[id];
    if (phase === 'defend' && G.foeCard) return m.def * advOf(m.cat, G.foeCard.cat);
    return m.atk * (G.weak === m.cat ? 1.2 : 1);
  };
  return G.hand.p.reduce((a, b) => (score(b.id) > score(a.id) ? b : a)).uid;
}
