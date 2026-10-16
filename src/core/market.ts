// market.ts — 市場事件 in casual duels. From turn 2, and then every 3 turns, a financial event is drawn. Until the next
// one it raises the attack of two attributes by 20 % and lowers one by 20 % — for both players alike, so it changes
// which card is the smart play, not who is favoured.
import { G } from './game';
import type { Cat } from './types';

export const EVENT_UP = 1.2, EVENT_DOWN = 0.8;
export const FIRST_TURN = 2, EVERY = 3;

export interface MarketEvent { id: string; name: string; up: Cat[]; down: Cat; why: string }
export const EVENTS: MarketEvent[] = [
  { id: 'hike', name: '升息', up: ['fx', 'money'], down: 'crypto', why: '資金成本上升：現金與存款變得有吸引力，懂資金管理與匯差的人受惠，高槓桿的虛擬貨幣承壓。' },
  { id: 'cut', name: '降息', up: ['etf', 'chips'], down: 'fx', why: '資金變便宜，股市資金行情與 ETF 受惠；利差縮小，外匯吸引力下降。' },
  { id: 'inflation', name: '通膨升溫', up: ['fund', 'deriv'], down: 'etf', why: '有定價能力的公司與避險工具較吃香；全市場資產的實質報酬被侵蝕。' },
  { id: 'jobless', name: '失業率攀升', up: ['risk', 'money'], down: 'chips', why: '收入不穩，緊急預備金與資金控管最重要；市場追價氣氛降溫。' },
  { id: 'crash', name: '股市暴跌', up: ['risk', 'deriv'], down: 'tech', why: '風險控管與避險部位發揮作用；技術線型在恐慌中頻頻失靈。' },
  { id: 'twd', name: '匯率劇烈波動', up: ['fx', 'deriv'], down: 'etf', why: '懂匯率與避險的人掌握主動；海外 ETF 的報酬受匯損影響。' },
  { id: 'recession', name: '經濟衰退', up: ['risk', 'fund'], down: 'crypto', why: '資金回到穩健資產與財務體質好的公司，投機性資產首當其衝。' },
  { id: 'bubble', name: '資產泡沫', up: ['crypto', 'tech'], down: 'money', why: '動能與投機當道，追價的技術面與虛擬貨幣暫時領風騷，按部就班的資金配置看起來落後。' },
];
export const byId = (id: string | null) => EVENTS.find(e => e.id === id) || null;

/** the event in force (null outside casual duels, or before turn 2) */
export const current = (): MarketEvent | null => (G && G.market && byId(G.market.id)) || null;

export function attackMult(cat: Cat): number {
  const e = current(); if (!e) return 1;
  return e.up.includes(cat) ? EVENT_UP : e.down === cat ? EVENT_DOWN : 1;
}

/** turn start: a new event on turn 2, 5, 8 …, never the same one twice in a row */
export function onTurn(turn: number, rnd: () => number = Math.random): MarketEvent | null {
  if (!G || !G.market || turn < FIRST_TURN || (turn - FIRST_TURN) % EVERY) return null;
  const pool = EVENTS.filter(e => e.id !== G.market!.id);
  const e = pool[Math.floor(rnd() * pool.length)];
  G.market.id = e.id; G.market.since = turn; G.market.seen++;
  return e;
}
export const nextTurn = (): number | null => (G && G.market ? (G.market.since ? G.market.since + EVERY : FIRST_TURN) : null);
export const describe = (e: MarketEvent, name: (c: Cat) => string): string => `${e.up.map(name).join('、')}攻擊 ×${EVENT_UP}，${name(e.down)} ×${EVENT_DOWN}`;
