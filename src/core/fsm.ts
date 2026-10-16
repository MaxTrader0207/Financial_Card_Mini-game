// fsm.ts — the duel's turn structure as an explicit state machine. A transition missing from TRANSITIONS is a bug
// (usually a stale async step of a duel that already ended): it is recorded in `violations` but never blocks play.
export const TRANSITIONS = {
  idle: ['intro'],
  intro: ['myTurn'],
  myTurn: ['attack', 'foeTurn'],
  attack: ['attackQuiz'],
  attackQuiz: ['attackResolve'],
  attackResolve: ['attack', 'foeTurn', 'over'],
  foeTurn: ['defend', 'myTurn'],
  defend: ['defendQuiz'],
  defendQuiz: ['defendResolve'],
  defendResolve: ['myTurn', 'over'],
  over: [],
} as const;
export type State = keyof typeof TRANSITIONS;

export interface Machine {
  readonly state: State;
  readonly trail: State[];
  readonly violations: string[];
  go(next: State): boolean;
}

export function createMachine({ strict = false } = {}): Machine {
  let state: State = 'idle';
  const trail: State[] = ['idle'], violations: string[] = [];
  return {
    get state() { return state; },
    trail, violations,
    go(next) {
      const ok = (TRANSITIONS[state] as readonly State[]).includes(next);
      if (!ok) {
        const msg = `illegal transition ${state} → ${next}`;
        if (strict) throw new Error(msg);
        violations.push(msg); console.warn('[fsm]', msg);
      }
      state = next; trail.push(next); if (trail.length > 400) trail.splice(0, trail.length - 400);
      return ok;
    },
  };
}
