// data-fetch.ts — the site build: cards and questions are plain JSON files next to the page (public/data/), so they can
// be edited without rebuilding.
import type { DataSet } from './types';

export async function loadData(): Promise<DataSet> {
  const get = async (f: string) => { const r = await fetch(`data/${f}`, { cache: 'no-cache' }); if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`); return r.json(); };
  const [c, q] = await Promise.all([get('cards.json'), get('questions.json')]);
  return { cards: c.cards, questions: q.questions };
}
