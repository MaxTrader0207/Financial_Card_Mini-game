// deck.ts — cards moving between deck and hand: build a shuffled deck from a 40-card list, draw up to the hand size,
// and refill a deck that ran out.
import { MON } from './cards';
import { HAND_SIZE, shuffle } from './constants';
import { G, nextUid } from './game';
import { Hooks } from './hooks';
import type { CardInst, Side } from './types';

export function makeDeck(list: string[]): CardInst[] {
  return shuffle(list.filter(id => MON[id]).map(id => ({ uid: nextUid(), id })));
}
/** when a deck runs out, a fresh shuffled deck replaces it so a long duel can never stall */
export function refillDeck(side: Side): void {
  if (!G.deck[side].length) { G.deck[side] = makeDeck(G.deckList[side]); Hooks.log('牌組用盡，重新洗牌補充。'); }
}
export function draw(side: Side): void {
  const h = G.hand[side];
  while (h.length < HAND_SIZE) { refillDeck(side); h.push(G.deck[side].pop()!); }
}
