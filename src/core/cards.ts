// cards.ts — the card pool: the 9 attributes, every card from data/cards.json (sorted by attribute → rank → ATK,
// each with its art variant v), lookup by id, and rarity names.
import type { Card, Cat, DataSet, Rarity } from './types';

export interface CatInfo { name: string; badge: string; jp: string; color: number; css: string }

export const CAT_ORDER: Cat[] = ['tech', 'fund', 'deriv', 'risk', 'chips', 'fx', 'crypto', 'etf', 'money'];
export const CATS: Record<Cat, CatInfo> = {
  tech: { name: '技術分析', badge: '技', jp: '技術分析', color: 0x3f7fe0, css: '#3f7fe0' },
  fund: { name: '基本面', badge: '財', jp: '基本面', color: 0x2f9e74, css: '#2f9e74' },
  deriv: { name: '衍生性商品', badge: '派', jp: '衍生商品', color: 0x8d5ee0, css: '#8d5ee0' },
  risk: { name: '風險管理', badge: '守', jp: '風險管理', color: 0xd8553a, css: '#d8553a' },
  chips: { name: '籌碼與市場', badge: '籌', jp: '籌碼市場', color: 0xc3902e, css: '#c3902e' },
  fx: { name: '外匯', badge: '匯', jp: '外匯', color: 0x1f9fb3, css: '#1f9fb3' },
  crypto: { name: '虛擬貨幣', badge: '幣', jp: '虛擬貨幣', color: 0xd9467f, css: '#d9467f' },
  etf: { name: 'ETF', badge: '指', jp: 'ETF', color: 0x6e9a2a, css: '#6e9a2a' },
  money: { name: '資金管理', badge: '資', jp: '資金管理', color: 0xc24fc8, css: '#c24fc8' },
};

export const RARITY: Record<number, Rarity> = { 1: 'N', 2: 'R', 3: 'SR', 4: 'UR' };
export const RARITY_TC: Record<Rarity, string> = { N: '普', R: '稀', SR: '超', UR: '極' };
export const RARITY_FULL: Record<Rarity, string> = { N: '普通', R: '稀有', SR: '超稀有', UR: '極稀有' };

export let MONSTERS: Card[] = [];
export let MON: Record<string, Card> = {};

export function initCards(data: Pick<DataSet, 'cards'>): void {
  const list = data.cards.map(m => ({ ...m, v: 0 })) as Card[];
  list.sort((a, b) => CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat) || a.rank - b.rank || b.atk - a.atk);
  const seen: Partial<Record<Cat, number>> = {};
  for (const m of list) { m.v = seen[m.cat] = (seen[m.cat] ?? -1) + 1; }
  MONSTERS = list;
  MON = Object.fromEntries(list.map(m => [m.id, m]));
}

export const isCat = (k: unknown): k is Cat => typeof k === 'string' && (CAT_ORDER as string[]).includes(k);
