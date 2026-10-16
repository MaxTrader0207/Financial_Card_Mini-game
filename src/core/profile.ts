// profile.ts — the player's small settings: difficulty, experience level and beginner protection, tutorial done,
// fast mode and sound. Same storage keys as the earlier versions of the game.
import { DIFFS } from './constants';
import { RECS } from './records';
import { Store, isObj } from './store';
import type { DiffKey } from './types';

const DIFF_KEY = 'soba-ketto.difficulty', TUT_KEY = 'soba-ketto.tutorial.v1', LEVEL_KEY = 'soba-ketto.level.v1', SET_KEY = 'soba-ketto.settings.v1', MUTE_KEY = 'soba-ketto.muted';

export function getDiff(): DiffKey { const v = Store.getRaw(DIFF_KEY); return v && v in DIFFS ? (v as DiffKey) : 'normal'; }
export function setDiff(k: DiffKey): void { Store.setRaw(DIFF_KEY, k); }

export const tutorialDone = (): boolean => Store.getRaw(TUT_KEY) === 'done';
export const markTutorialDone = (): void => Store.setRaw(TUT_KEY, 'done');

export type Level = 'new' | 'some' | 'pro';
export const LEVELS: Record<Level, { name: string; desc: string; diff: DiffKey }> = {
  new: { name: '完全新手', desc: '簡易難度（每題 30 秒），前 3 場休閒對戰只出初階題，對手也比較常擋失手', diff: 'easy' },
  some: { name: '懂一點', desc: '適中難度（每題 20 秒），先玩一場新手場熟悉規則', diff: 'normal' },
  pro: { name: '交易老手', desc: '略過新手場，直接開始對戰', diff: 'normal' },
};
export function level(): Level | null {
  const o = Store.load<{ level?: Level }>(LEVEL_KEY, { version: 1, fallback: () => ({}), validate: isObj });
  return o.level && o.level in LEVELS ? o.level : null;
}
export function setLevel(k: Level): void {
  Store.save(LEVEL_KEY, 1, { level: k, at: Date.now() });
  setDiff(LEVELS[k].diff);
  if (k === 'pro') markTutorialDone();
}
export const PROTECT_DUELS = 3;
const casualDone = () => RECS.filter(r => (r.mode || 'casual') === 'casual').length;
/** protected duels left for a 完全新手 */
export const protectLeft = (): number => (level() === 'new' ? Math.max(0, PROTECT_DUELS - casualDone()) : 0);
/** two casual losses in a row above 簡易 → suggest 簡易 */
export function suggestEasier(): boolean {
  const c = RECS.filter(r => (r.mode || 'casual') === 'casual').slice(-2);
  return c.length === 2 && c.every(r => !r.win) && c.every(r => r.diff && r.diff !== 'easy') && getDiff() !== 'easy';
}

export interface Settings { fast: boolean; music: number; sfx: number }
export function settings(): Settings {
  return { fast: false, music: 100, sfx: 100, ...Store.load<Partial<Settings>>(SET_KEY, { version: 1, fallback: () => ({}), validate: isObj }) };
}
export function saveSettings(s: Settings): void { Store.save(SET_KEY, 1, s); }
export const muted = (): boolean => Store.getRaw(MUTE_KEY) === '1';
export const setMuted = (m: boolean): void => Store.setRaw(MUTE_KEY, m ? '1' : '0');
