// Whole duels played headless through the real rules, with a stub presenter that answers automatically.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { setupData } from '../src/core/setup';
import { Store } from '../src/core/store';
import { G } from '../src/core/game';
import { MONSTERS, MON } from '../src/core/cards';
import { SKILLS, ctx } from '../src/core/skills';
import { BANK } from '../src/core/bank';
import { COL, DECK, autoDeck, deckValid } from '../src/core/collection';
import { RECS } from '../src/core/records';
import { onPlay, setPresenter, startDuel, type Presenter, type QuizSpec } from '../src/core/duel';
import { advOf, BEATS } from '../src/core/rules';
import type { DataSet } from '../src/core/types';

const data: DataSet = {
  cards: JSON.parse(readFileSync('public/data/cards.json', 'utf8')).cards,
  questions: JSON.parse(readFileSync('public/data/questions.json', 'utf8')).questions,
};

/** a presenter that never waits; answers right with probability `acc` and plays the first hand card when asked */
function stub(acc: number) {
  let ended: (win: boolean) => void = () => {};
  const done = new Promise<boolean>(r => { ended = r; });
  const p: Presenter = {
    wait: async () => {}, transition: async () => {}, log: () => {}, render: () => {}, renderHands: () => {},
    setPhase: (phase) => { if (phase === 'attack' || phase === 'defend') queueMicrotask(() => { if (!G.over && G.hand.p.length) void onPlay(G.hand.p[0].uid); }); },
    placeField: () => {}, clearField: () => {}, floatText: () => {},
    damage: async () => {}, heal: async () => {}, lunge: async () => {}, shatter: async () => {}, skillFX: async () => {}, marketEvent: async () => {},
    ask: async (s: QuizSpec) => ({ pos: Math.random() < acc ? s.correctPos : (s.correctPos + 1) % s.order.length, time: 3, retried: false, firstPos: null }),
    feedback: async () => {}, foeAnswer: async () => {}, coach: async () => {},
    end: async win => { ended(win); },
  };
  return { p, done };
}

beforeAll(() => { Store.reset(); setupData(data); });
beforeEach(() => { Store.reset(); });

describe('data', () => {
  it('has 180 cards with skills and a large question bank', () => {
    expect(MONSTERS.length).toBe(180);
    expect(MONSTERS.every(m => SKILLS[m.id] && SKILLS[m.id].name)).toBe(true);
    expect(BANK.length).toBeGreaterThanOrEqual(900);
  });
  it('the starter collection builds a legal 40-card deck', () => {
    expect(COL.owned.length).toBeGreaterThan(0);
    expect(deckValid(autoDeck())).toBe(true);
    expect(deckValid(DECK)).toBe(true);
  });
  it('type advantage is a 9-cycle', () => {
    for (const [a, b] of Object.entries(BEATS)) { expect(advOf(a as any, b)).toBe(1.5); expect(advOf(b, a as any)).toBe(0.5); }
  });
});

describe('every skill hook runs', () => {
  it('without throwing in a running duel', async () => {
    const { p } = stub(1); setPresenter(p);
    await startDuel({ diff: 'normal' });
    for (const m of MONSTERS) {
      const sk = SKILLS[m.id];
      for (const side of ['p', 'c'] as const) {
        const c = ctx(side, { atk: m.atk, dmg: m.atk, def: m.def, left: 5, fast: true, reflect: 200, pierce: 0 });
        expect(() => { sk.hit?.(c); sk.miss?.(c); sk.defOk?.(c); sk.defFail?.(c); if (typeof sk.defBonus === 'function') sk.defBonus(); }, m.id).not.toThrow();
        expect(Number.isFinite(c.dmg) && Number.isFinite(c.heal) && Number.isFinite(c.mult), m.id).toBe(true);
      }
    }
  });
});

describe('whole duels', () => {
  for (const [diff, acc] of [['easy', 0.9], ['normal', 0.6], ['hard', 0.3]] as const) {
    it(`${diff}, answering ${acc * 100}% right, ends cleanly`, async () => {
      const { p, done } = stub(acc); setPresenter(p);
      await startDuel({ diff });
      const win = await done;
      expect(G.over).toBe(true);
      expect(G.fsm.violations).toEqual([]);
      expect(win ? G.lp.c : G.lp.p).toBe(0);
      expect(G.stats.total).toBeGreaterThan(0);
      expect(G.history.length).toBe(G.stats.total);
      expect(RECS.at(-1)!.total).toBe(G.stats.total);
    }, 20000);
  }
  it('the tutorial duel starts the opponent at half money and asks 初階 only', async () => {
    const { p, done } = stub(1); setPresenter(p);
    await startDuel({ tutorial: true });
    expect(G.diff.key).toBe('easy');
    await done;
    expect(G.history.every(h => h.diff === 1)).toBe(true);
    expect(G.fsm.violations).toEqual([]);
  }, 20000);
  it('a winner is offered reward cards it does not own yet', async () => {
    const { p, done } = stub(1); setPresenter(p);
    await startDuel({ diff: 'easy' });
    expect(await done).toBe(true);
    expect(G.reward && G.reward.length).toBeGreaterThan(0);
    expect(G.reward!.every(id => MON[id] && !COL.owned.includes(id))).toBe(true);
  }, 20000);
});
