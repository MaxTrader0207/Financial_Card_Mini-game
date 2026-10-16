// duel.ts — the duel's turn order: start a duel, our attack, the opponent's attack, resolving each answer, and the end.
// Pure game logic: everything the player sees goes through the Presenter (the Phaser duel scene in the game, a stub in
// tests and simulations), so a whole duel can be played headless.
import { cpuPick } from './ai';
import { foeQuestion, pickQuestion } from './bank';
import { attackHit, attackMiss, defendFail, defendOk, defendSetup, foeAtkOf, foeBlock, foeProfile, type Answer, type Block } from './calc';
import { CATS, MON } from './cards';
import { COL, colSave, cpuDeckList, playDeck, rewardOffer } from './collection';
import { DIFFS, LP_MAX, shuffle } from './constants';
import { draw, makeDeck } from './deck';
import { createMachine } from './fsm';
import { G, setGame, stale, type Game, type Mode, type Phase } from './game';
import * as Market from './market';
import { getDiff, markTutorialDone, protectLeft } from './profile';
import { qsRecord, recordGame, weakCat } from './records';
import { ADV_DOWN, ADV_UP, ADV_WHY, WEAK_MULT, advOf } from './rules';
import { SKILLS } from './skills';
import { ensureAdvantage, setupTutorial, suggestCard, tutorialFoeLp, tutorialFoeMiss } from './tutorial';
import type { Card, Question, Side } from './types';

export type Tone = 'gold' | 'ally' | 'foe' | 'lose';
export type CoachStep = 'goal' | 'hand' | 'quiz' | 'feedback' | 'foe' | 'defend' | 'skill' | 'done';

/** what the quiz screen needs to ask one question */
export interface QuizSpec {
  q: Question;
  /** display position → option index */
  order: number[];
  /** display positions of removed wrong options */
  removed: number[];
  correctPos: number;
  limit: number;
  retry: boolean;
  mode: 'attack' | 'defend';
  card: Card;
  foe: Card | null;
  meta: string;
  advLine: string;
  skillName: string;
  /** a skill changed the question (remove options / more time): announce it */
  skillNote: string;
}
/** the player's answer: display position (−1 = time out), seconds used, and whether a retry skill was used */
export interface QuizPick { pos: number; time: number; retried: boolean; firstPos: number | null }
export interface QuizFeedback { correct: boolean; verdict: string; detail: string; explain: string; answerText: string; cont: string }

export interface Presenter {
  wait(ms: number): Promise<void>;
  transition(title: string, sub: string, tone: Tone): Promise<void>;
  log(html: string): void;
  render(): void;
  renderHands(): void;
  setPhase(phase: Phase, label: string, hint: string, suggestUid?: number | null): void;
  placeField(side: Side, card: Card, mode: 'attack' | 'defend'): void;
  clearField(side: Side): void;
  floatText(side: Side, text: string, kind?: 'small' | 'skill' | 'heal' | 'big'): void;
  /** LP already changed in G; animate from → to */
  damage(side: Side, amount: number, from: number, to: number, tags: string[]): Promise<void>;
  heal(side: Side, amount: number, from: number, to: number): Promise<void>;
  lunge(side: Side): Promise<void>;
  shatter(side: Side): Promise<void>;
  skillFX(side: Side, card: Card): Promise<void>;
  marketEvent(e: Market.MarketEvent | null): Promise<void>;
  ask(spec: QuizSpec): Promise<QuizPick>;
  feedback(fb: QuizFeedback): Promise<void>;
  foeAnswer(q: Question, blk: Block, attacker: Card): Promise<void>;
  coach(step: CoachStep): Promise<void>;
  end(win: boolean): Promise<void>;
}

let P: Presenter;
export function setPresenter(p: Presenter): void { P = p; }

const catName = (k: keyof typeof CATS) => CATS[k].name;
const esc = (s: string) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface StartOpts { tutorial?: boolean; diff?: keyof typeof DIFFS }

export function newGame(mode: Mode, diffKey = getDiff()): Game {
  const deckList = { p: playDeck(), c: cpuDeckList(diffKey) };
  const g: Game = {
    fsm: createMachine(), diff: DIFFS[diffKey], mode, deckList, weak: weakCat(), lp: { p: LP_MAX, c: LP_MAX },
    deck: { p: makeDeck(deckList.p), c: makeDeck(deckList.c) }, hand: { p: [], c: [] }, turn: 0, phase: 'idle', busy: false,
    used: new Set(), streak: 0, maxStreak: 0, mods: { myAtk: 0, foeAtk: 0, skipFoe: false, skipMe: false }, flags: {}, extraUsed: false,
    history: [], stats: { total: 0, correct: 0, byCat: {} }, missed: [], foeCard: null, foeProf: foeProfile(), foeStats: { t: 0, c: 0 },
    market: null, tutorial: null, newbie: false, dealt: 0, taken: 0, startedAt: Date.now(), endedAt: null, win: null, over: false,
  };
  setGame(g);
  return g;
}

export async function startDuel(opts: StartOpts = {}): Promise<void> {
  const tutorial = !!opts.tutorial;
  newGame(tutorial ? 'tutorial' : 'casual', opts.diff);
  if (tutorial) setupTutorial();
  else { G.market = { id: null, since: 0, seen: 0 }; G.newbie = protectLeft() > 0; }
  G.fsm.go('intro');
  P.render();
  P.log(tutorial ? `新手場：難度固定為簡易，只出初階題，對手資金 ${tutorialFoeLp()}。`
    : '雙方洗牌完畢。從第 2 回合起每 3 回合發生一次市場事件。' + (G.newbie ? ` 新手保護（還有 ${protectLeft()} 場）：只出初階題，對手也比較常擋失手。` : ''));
  P.setPhase('idle', '待機', '');
  const g = G;
  await P.transition(tutorial ? '新手場' : '對決開始', tutorial ? '一步一步學會出牌、答題、防禦' : `難易度 ${G.diff.name} · 雙方準備就緒`, 'gold');
  if (stale(g)) return;
  if (tutorial) { await P.coach('goal'); if (stale(g)) return; }
  void playerTurn();
}

/** leave the duel without finishing (counts in the learning record as quit) */
export function abandon(): void {
  if (!G || G.over) return;
  G.over = true; G.endedAt = Date.now(); recordGame(true);
}

async function playerTurn(): Promise<void> {
  const g = G; if (stale(g)) return;
  G.fsm.go('myTurn');
  G.turn++; G.extraUsed = false; draw('p'); draw('c'); P.render();
  const ev = Market.onTurn(G.turn);
  if (ev) {
    await P.marketEvent(ev); if (stale(g)) return;
    P.log(`<b>市場事件【${esc(ev.name)}】</b> ${esc(ev.why)} ${Market.describe(ev, catName)}（雙方適用，持續 ${Market.EVERY} 回合）`);
  }
  if (G.mods.skipMe) {
    G.mods.skipMe = false;
    await P.transition('我方回合', `第 ${G.turn} 回合 · 漲停鎖死，無法攻擊`, 'ally'); if (stale(g)) return;
    P.log('我方被【漲停鎖死】，跳過本次攻擊。'); await P.wait(600);
    void cpuTurn(); return;
  }
  await P.transition('我方回合', `第 ${G.turn} 回合 · 我方攻擊`, 'ally'); if (stale(g)) return;
  P.log('選一張手牌召喚，答對題目即可攻擊。' + (G.mods.myAtk ? ` 本次攻擊 ${G.mods.myAtk > 0 ? '+' : ''}${G.mods.myAtk}。` : ''));
  G.fsm.go('attack');
  P.setPhase('attack', '攻擊階段', '選擇要召喚的卡牌', G.tutorial ? suggestCard('attack') : null);
  if (G.tutorial && G.turn === 1) void P.coach('hand');
}

async function cpuTurn(): Promise<void> {
  const g = G; if (stale(g)) return;
  G.fsm.go('foeTurn');
  P.setPhase('idle', '對手回合', '');
  if (G.mods.skipFoe) {
    G.mods.skipFoe = false;
    await P.transition('對手回合', `第 ${G.turn} 回合 · 漲停鎖死，無法攻擊`, 'foe'); if (stale(g)) return;
    P.log('對手被【漲停鎖死】，跳過本次攻擊。'); await P.wait(600);
    void playerTurn(); return;
  }
  await P.transition('對手回合', `第 ${G.turn} 回合 · 對手攻擊`, 'foe'); if (stale(g)) return;
  if (!G.hand.c.length) draw('c');
  const inst = G.hand.c.splice(cpuPick(), 1)[0];
  const m = MON[inst.id]; G.foeCard = m;
  const atk = foeAtkOf(m);
  P.renderHands(); P.placeField('c', m, 'attack');
  const sk = SKILLS[m.id];
  P.log(`對手召喚 <b>【${esc(m.name)}】</b>，攻擊力 ${atk}${G.diff.foeMult !== 1 ? `（卡面 ${m.atk} × ${G.diff.foeMult}）` : ''}${G.mods.foeAtk ? `（追繳 ${G.mods.foeAtk}）` : ''}！`
    + (sk.hit ? ` 技能【${esc(sk.name)}】：${esc(sk.text)}` : '') + (G.weak === m.cat && G.diff.key !== 'easy' ? ' 對手瞄準了你的弱項！' : ''));
  await P.wait(450); if (stale(g)) return;
  if (!G.hand.p.length) draw('p');
  const tutSuggest = ensureAdvantage(m);
  G.fsm.go('defend');
  P.renderHands();
  P.setPhase('defend', '防禦階段', `選一張卡抵擋 攻 ${atk} · 題目：${CATS[m.cat].name}`, G.tutorial ? (tutSuggest ?? suggestCard('defend')) : null);
  if (G.tutorial && !G.flags.tutDefendShown) { G.flags.tutDefendShown = true; void P.coach('defend'); }
}

/** the player plays a hand card (attack or block) */
export async function onPlay(uid: number): Promise<void> {
  if (!G || G.busy || (G.phase !== 'attack' && G.phase !== 'defend')) return;
  const idx = G.hand.p.findIndex(i => i.uid === uid); if (idx < 0) return;
  G.busy = true;
  const m = MON[G.hand.p.splice(idx, 1)[0].id];
  const mode = G.phase;
  G.fsm.go(mode === 'attack' ? 'attackQuiz' : 'defendQuiz');
  P.setPhase('busy', mode === 'attack' ? '攻擊階段' : '防禦階段', '');
  P.renderHands(); P.placeField('p', m, mode);
  P.log(mode === 'attack' ? `召喚 <b>【${esc(m.name)}】</b>！` : `以 <b>【${esc(m.name)}】</b> 守備表示迎擊！`);
  await P.wait(550);
  if (mode === 'attack') await resolveAttack(m); else await resolveDefend(m, G.foeCard!);
  G.busy = false;
}

/** pick, ask and score one question; records the answer in the duel stats and the learning record */
async function ask(m: Card, mode: 'attack' | 'defend', foe: Card | null): Promise<Answer> {
  const q = pickQuestion(mode === 'defend' && foe ? foe.cat : m.cat, m.rank);
  const sk = SKILLS[m.id], qz = sk.quiz || {};
  const order = shuffle(q.options.map((_, i) => i));
  const correctPos = order.indexOf(q.answer);
  const removed = qz.remove ? shuffle(order.map((_, i) => i).filter(i => i !== correctPos)).slice(0, Math.min(qz.remove, order.length - 2)) : [];
  const limit = G.diff.time + (qz.extraTime || 0);
  const a = mode === 'defend' && foe ? advOf(m.cat, foe.cat) : 1, weak = mode === 'attack' && G.weak === m.cat;
  const advLine = foe && a > 1 ? `屬性相剋：${CATS[m.cat].name}剋${CATS[foe.cat].name}（${ADV_WHY[m.cat]}），守備力 ×${ADV_UP}`
    : foe && a < 1 ? `屬性被剋：${CATS[foe.cat].name}剋${CATS[m.cat].name}（${ADV_WHY[foe.cat]}），守備力 ×${ADV_DOWN}`
    : weak ? `弱項挑戰：答對傷害 ×${WEAK_MULT}` : '';
  const meta = `${CATS[q.category].name} · ${['', '初階', '中階', '進階'][q.difficulty]} · 限時 ${limit} 秒` + (mode === 'defend' && foe ? ` · 對手實際攻擊 ${foeAtkOf(foe)}` : '');
  const skillNote = qz.remove || qz.extraTime ? `【${sk.name}】${[qz.remove && `刪去 ${qz.remove} 個錯誤選項`, qz.extraTime && `答題時間 +${qz.extraTime} 秒`].filter(Boolean).join('、')}` : '';
  if (G.tutorial && !G.flags.tutQuizShown) { G.flags.tutQuizShown = true; void P.coach('quiz'); }
  const pick = await P.ask({ q, order, removed, correctPos, limit, retry: !!qz.retry, mode, card: m, foe, meta, advLine, skillName: sk.name, skillNote });
  const correct = pick.pos !== -1 && pick.pos === correctPos;
  const time = Math.min(pick.time, limit);
  G.stats.total++;
  const bc = G.stats.byCat[q.category] || (G.stats.byCat[q.category] = { t: 0, c: 0 }); bc.t++;
  const answerText = q.options[q.answer];
  if (correct) { G.stats.correct++; bc.c++; G.streak++; } else { G.streak = 0; G.missed.push({ q: q.q, a: answerText, e: q.explain, cat: q.category }); }
  G.maxStreak = Math.max(G.maxStreak, G.streak);
  qsRecord(q.id, correct && !pick.retried);
  G.history.push({ turn: G.turn, mode, card: m.name, cat: q.category, diff: q.difficulty, q: q.q, chosen: pick.pos === -1 ? null : q.options[order[pick.pos]],
    answer: answerText, correct, time, timeout: pick.pos === -1, explain: q.explain, retried: pick.retried });
  P.render();
  const tLabel = pick.pos === -1 ? '時間到' : `${time.toFixed(1)} 秒${pick.retried ? ' · 第二次作答' : ''}`;
  const fbDone = P.feedback({ correct, verdict: correct ? '正解！' : '不正解', detail: tLabel, explain: q.explain || `正確答案：${answerText}`, answerText,
    cont: correct ? (mode === 'attack' ? '發動攻擊 ▶' : '展開防禦 ▶') : '繼續 ▶' });
  if (G.tutorial && !G.flags.tutFeedbackShown) { G.flags.tutFeedbackShown = true; void P.coach('feedback'); }
  await fbDone;
  return { correct, time, left: limit - time, retried: pick.retried };
}

function hurt(side: Side, amt: number): { from: number; to: number } {
  const from = G.lp[side], to = Math.max(0, from - amt); G.lp[side] = to;
  if (side === 'c') G.dealt += amt; else G.taken += amt;
  return { from, to };
}
async function damage(side: Side, amt: number, tags: string[]): Promise<void> {
  if (amt <= 0) return;
  const { from, to } = hurt(side, amt);
  await P.damage(side, amt, from, to, tags);
}
async function heal(side: Side, amt: number): Promise<void> {
  if (amt <= 0) return;
  const from = G.lp[side], to = Math.min(LP_MAX, from + amt); if (to === from) return;
  G.lp[side] = to;
  await P.heal(side, to - from, from, to);
}
async function skillFX(side: Side, m: Card): Promise<void> {
  const sk = SKILLS[m.id];
  P.log(`${side === 'p' ? '' : '對手的'}<b>【${esc(m.name)}】</b>發動技能【${esc(sk.name)}】：${esc(sk.text)}`);
  await P.skillFX(side, m);
}

async function resolveAttack(m: Card): Promise<void> {
  const g = G;
  const r = await ask(m, 'attack', null);
  if (stale(g)) return;
  G.fsm.go('attackResolve');
  let extra = false;
  if (r.correct) {
    const out = attackHit(m, r);
    if (out.fired) await skillFX('p', m);
    let blk = foeBlock(m, out.dmg);
    if (blk && blk.ok && tutorialFoeMiss()) { blk = { ...blk, ok: false, dmg: out.dmg }; G.foeStats.c--; }
    if (blk) {
      P.renderHands(); P.placeField('c', blk.card, 'defend');
      const advTxt = blk.adv > 1 ? `，${CATS[blk.card.cat].name}剋${CATS[m.cat].name}，守備 ×${blk.adv}` : blk.adv < 1 ? `，被${CATS[m.cat].name}剋制，守備 ×${blk.adv}` : '';
      P.log(`對手以 <b>【${esc(blk.card.name)}】</b> 防禦（守備 ${blk.def}${advTxt}）…`);
      await P.wait(400); if (stale(g)) return;
      const fq = foeQuestion(m.cat, m.rank);
      if (fq) {
        if (G.tutorial && !G.flags.tutFoeShown) { G.flags.tutFoeShown = true; void P.coach('foe'); }
        await P.foeAnswer(fq, blk, m); if (stale(g)) return;
      }
      P.floatText('c', blk.ok ? '對手答對' : '對手答錯', 'small');
      await P.wait(300);
    }
    P.log(`<b>【${esc(m.name)}】</b> 發動攻擊！`);
    await P.lunge('p');
    const dealt = blk ? blk.dmg : out.dmg;
    if (dealt > 0) await damage('c', dealt, blk && blk.ok ? [...out.tags, `擋下 ${out.dmg - dealt}`] : out.tags);
    else { P.floatText('c', '完全防禦', 'small'); await P.wait(350); }
    if (out.heal) await heal('p', out.heal);
    P.log(blk && blk.ok ? `對手擋下部分攻擊，造成 <b>${dealt}</b> 點傷害。` : `造成 <b>${dealt}</b> 點傷害。`);
    if (blk) { await P.wait(200); P.clearField('c'); }
    extra = out.extra;
  } else {
    const out = attackMiss(m);
    if (out.fired) await skillFX('p', m);
    if (out.dmg > 0) { await P.lunge('p'); await damage('c', out.dmg, ['失敗仍命中']); P.log(`攻擊失敗，但仍造成 <b>${out.dmg}</b> 點傷害。`); }
    else P.log(`答錯了，<b>【${esc(m.name)}】</b> 攻擊失敗被送入墓地。`);
    await P.shatter('p');
    if (out.backlash) { await damage('p', out.backlash, ['反噬']); P.log(`槓桿反噬，我方承受 <b>${out.backlash}</b> 點傷害。`); }
    if (out.heal) await heal('p', out.heal);
  }
  await P.wait(300); P.clearField('p');
  if (await checkEnd()) return;
  if (extra && G.hand.p.length) {
    G.extraUsed = true;
    P.log('【當沖】發動，本回合可以再出一張牌攻擊。');
    G.fsm.go('attack');
    P.setPhase('attack', '攻擊階段', '當沖：再選一張卡攻擊');
    return;
  }
  void cpuTurn();
}

async function resolveDefend(m: Card, foe: Card): Promise<void> {
  const g = G;
  const r = await ask(m, 'defend', foe);
  if (stale(g)) return;
  G.fsm.go('defendResolve');
  const s = defendSetup(m, foe);
  let announced = false;
  if (s.defBonus) { await skillFX('p', m); announced = true; P.floatText('p', `守備 +${s.defBonus}`, 'small'); }
  if (s.adv !== 1) {
    P.floatText('p', s.adv > 1 ? `相剋 守備 ×${s.adv}` : `被剋 守備 ×${s.adv}`, 'small');
    P.log(s.adv > 1 ? `${CATS[m.cat].name}剋制${CATS[foe.cat].name}，守備力提升為 <b>${s.def}</b>。` : `${CATS[foe.cat].name}剋制${CATS[m.cat].name}，守備力降為 <b>${s.def}</b>。`);
    await P.wait(450);
  }
  await P.lunge('c');
  if (r.correct) {
    const out = defendOk(m, s, r);
    if (out.fired && !announced) await skillFX('p', m);
    if (out.pierce > 0) { P.log(`擋下部分攻擊，貫通 <b>${out.pierce}</b> 點。`); await damage('p', out.pierce, ['貫通', ...s.atkTags]); }
    else if (out.reflect > 0) { P.log(`完美防禦！反彈 <b>${out.reflect}</b> 點。`); P.floatText('p', '完全防禦', 'small'); await damage('c', out.reflect, ['反射']); }
    else { P.log('攻守相抵，完全防禦！'); P.floatText('p', '完全防禦', 'small'); await P.wait(450); }
    if (out.heal) await heal('p', out.heal);
  } else {
    const out = defendFail(m, foe, s);
    if (out.foeFired) await skillFX('c', foe);
    if (out.fired && !announced) await skillFX('p', m);
    P.log(`防禦失敗，承受 <b>${out.dmg}</b> 點直擊。`);
    await P.shatter('p'); await damage('p', out.dmg, ['直擊', ...s.atkTags]);
    if (out.foeHeal) await heal('c', out.foeHeal);
  }
  await P.wait(300); P.clearField('p'); P.clearField('c'); G.foeCard = null;
  if (G.tutorial && !G.flags.tutSkillShown && G.turn >= 1) { G.flags.tutSkillShown = true; await P.coach('skill'); if (stale(g)) return; }
  if (await checkEnd()) return;
  void playerTurn();
}

async function checkEnd(): Promise<boolean> {
  if (G.lp.c > 0 && G.lp.p > 0) return false;
  G.fsm.go('over');
  G.over = true; const win = G.lp.c <= 0; G.win = win; G.endedAt = Date.now();
  if (G.tutorial) markTutorialDone();
  recordGame(false);
  if (win && !COL.pending) { COL.pending = rewardOffer(G.diff.key); colSave(); }
  G.reward = win ? COL.pending : null;
  P.setPhase('idle', win ? '勝利' : '敗北', '');
  await P.wait(250);
  await P.transition(win ? '勝利' : '敗北', win ? '對手資金歸零' : '我方資金歸零', win ? 'gold' : 'lose');
  if (G.tutorial) await P.coach('done');
  await P.end(win);
  return true;
}
