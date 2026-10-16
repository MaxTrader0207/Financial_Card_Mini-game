// types.ts — shared data shapes: attributes, cards, questions, difficulty.

export type Cat = 'tech' | 'fund' | 'deriv' | 'risk' | 'chips' | 'fx' | 'crypto' | 'etf' | 'money';
export type Side = 'p' | 'c';
export type DiffKey = 'easy' | 'normal' | 'hard';
export type Rarity = 'N' | 'R' | 'SR' | 'UR';

export interface Card {
  id: string;
  name: string;
  cat: Cat;
  rank: 1 | 2 | 3 | 4;
  atk: number;
  def: number;
  race: string;
  sigil: string;
  text: string;
  /** variant number within its attribute (art selection), set when the card list is loaded */
  v: number;
}

export interface Question {
  id: string;
  category: Cat;
  difficulty: 1 | 2 | 3;
  q: string;
  options: string[];
  answer: number;
  explain: string;
  asOf?: string;
  reviewBy?: string;
}

export interface DataSet {
  cards: Omit<Card, 'v'>[];
  questions: Question[];
}

export interface Diff {
  key: DiffKey;
  name: string;
  /** seconds per question */
  time: number;
  /** answer within this many seconds for the 速攻 bonus */
  fast: number;
  /** the opponent's ATK multiplier */
  foeMult: number;
}

/** one physical card in a deck or hand */
export interface CardInst { uid: number; id: string }
