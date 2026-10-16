// setup.ts — turn the loaded data into the game's tables and read the player's saved state.
import { initBank } from './bank';
import { initCards } from './cards';
import { loadCollection } from './collection';
import { loadRecords } from './records';
import { fillMissingSkills } from './skills';
import type { DataSet } from './types';

export function setupData(data: DataSet): void {
  initCards(data);
  fillMissingSkills();
  initBank(data.questions);
  loadRecords();
  loadCollection();
}
