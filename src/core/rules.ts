// rules.ts — the type-advantage cycle and multipliers, and the weak-attribute bonus.
import type { Cat } from './types';

/** each attribute beats the next one in the cycle */
export const ADV_CYCLE: Cat[] = ['risk', 'deriv', 'crypto', 'fx', 'chips', 'fund', 'etf', 'money', 'tech'];
export const BEATS = Object.fromEntries(ADV_CYCLE.map((k, i) => [k, ADV_CYCLE[(i + 1) % ADV_CYCLE.length]])) as Record<Cat, Cat>;
export const ADV_WHY: Record<Cat, string> = {
  risk: '部位控管壓得住槓桿', deriv: '期貨與選擇權避險，化解幣價暴漲暴跌', crypto: '去中心化資產不受單一國家的匯率政策左右',
  fx: '匯率牽動熱錢進出，外資買賣跟著匯率走', chips: '短線資金流向蓋過基本面', fund: '看懂成分股的基本面，才挑得出勝過大盤的標的',
  etf: '一檔指數化 ETF 就分散好資金，省去逐筆配置的盤算', money: '部位與資金控管得宜，單一訊號失誤也不致命', tech: '看準進出場點，風控也得跟著價格走',
};
export const ADV_UP = 1.5;
export const ADV_DOWN = 0.5;
export const WEAK_MULT = 1.2;

/** multiplier on the defender's DEF */
export function advOf(defCat: Cat, atkCat: Cat): number {
  if (BEATS[defCat] === atkCat) return ADV_UP;
  if (BEATS[atkCat] === defCat) return ADV_DOWN;
  return 1;
}
