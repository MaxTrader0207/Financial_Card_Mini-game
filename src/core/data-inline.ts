// data-inline.ts — the single-file build: cards and questions are bundled into the page.
import cards from '../../public/data/cards.json';
import questions from '../../public/data/questions.json';
import type { DataSet } from './types';

export async function loadData(): Promise<DataSet> {
  return { cards: cards.cards, questions: questions.questions } as unknown as DataSet;
}
