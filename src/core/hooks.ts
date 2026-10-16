// hooks.ts — the few things rule code needs to tell the screen (a skill discarded a card, a deck was reshuffled).
// The duel scene installs real handlers; tests and simulations keep the no-op defaults.
import type { Side } from './types';

export const Hooks = {
  handChanged: (): void => {},
  note: (_side: Side, _text: string): void => {},
  log: (_html: string): void => {},
};
export function setHooks(h: Partial<typeof Hooks>): void { Object.assign(Hooks, h); }
