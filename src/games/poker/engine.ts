import { buildDeck, Card, randomInt, shuffle } from "../cards";
import { Engine, GameError, SeatInfo } from "../types";
import { evaluate, quickScore } from "./evaluator";

export interface PokerSettings {
  startingChips: number;
  bigBlind: number;
  /** Blinds double every N hands; 0 keeps them fixed. */
  blindLevelHands: number;
}

export type PokerAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; to: number }
  | { type: "allin" };

type Street = "preflop" | "flop" | "turn" | "river" | "handover" | "gameover";

interface PPlayer {
  id: string;
  name: string;
  isBot: boolean;
  chips: number;
  hole: Card[];
  /** Chips put in during the current street. */
  bet: number;
  /** Chips put in during the whole hand. */
  total: number;
  folded: boolean;
  allIn: boolean;
  out: boolean;
  acted: boolean;
  revealed: boolean;
  lastAction: string | null;
}

export interface PotResult {
  amount: number;
  winners: string[];
  handName: string | null;
}

export interface HandResult {
  showdown: boolean;
  pots: PotResult[];
  /** Net chips each winner collected. */
  won: Record<string, number>;
  handNames: Record<string, string>;
  bestCards: Record<string, string[]>;
}

export interface PokerState {
  settings: PokerSettings;
  players: PPlayer[];
  dealer: number;
  sbIdx: number;
  bbIdx: number;
  sb: number;
  bb: number;
  handNo: number;
  deck: Card[];
  board: Card[];
  street: Street;
  toAct: number | null;
  currentBet: number;
  minRaise: number;
  /** All remaining players are all-in; the board is dealt out one street at a time. */
  runout: boolean;
  result: HandResult | null;
  log: string[];
  bustOrder: string[];
  /** Bumped on every action so each decision is a distinct turn. */
  seq: number;
}

export interface PokerSeatView {
  id: string;
  name: string;
  isBot: boolean;
  chips: number;
  bet: number;
  folded: boolean;
  allIn: boolean;
  out: boolean;
  lastAction: string | null;
  /** null entries are face-down cards. */
  cards: (Card | null)[];
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
}

export interface PokerView {
  game: "poker";
  players: PokerSeatView[];
  board: Card[];
  pot: number;
  street: Street;
  toActId: string | null;
  handNo: number;
  sb: number;
  bb: number;
  result: HandResult | null;
  runout: boolean;
  log: string[];
  myHandName: string | null;
  actions: {
    canCheck: boolean;
    canCall: boolean;
    callAmount: number;
    canRaise: boolean;
    minRaiseTo: number;
    maxRaiseTo: number;
    currentBet: number;
    myBet: number;
  } | null;
  standings: { id: string; name: string; chips: number }[] | null;
}

const fmt = (n: number) => n.toLocaleString("en-US");

function pushLog(s: PokerState, line: string) {
  s.log.push(line);
  if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
}

function next(s: PokerState, from: number, pred: (p: PPlayer) => boolean): number {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (pred(s.players[i])) return i;
  }
  return -1;
}

const inHand = (p: PPlayer) => !p.out && !p.folded;
const canAct = (p: PPlayer) => !p.out && !p.folded && !p.allIn;

function pay(s: PokerState, p: PPlayer, amount: number) {
  const a = Math.min(amount, p.chips);
  p.chips -= a;
  p.bet += a;
  p.total += a;
  if (p.chips === 0) p.allIn = true;
  return a;
}

function deal(s: PokerState, count: number) {
  s.deck.pop(); // burn
  for (let i = 0; i < count; i++) s.board.push(s.deck.pop()!);
}

function startHand(s: PokerState) {
  for (const p of s.players) {
    if (!p.out && p.chips <= 0) {
      p.out = true;
      s.bustOrder.push(p.id);
    }
  }
  const alive = s.players.filter((p) => !p.out);
  if (alive.length <= 1) {
    s.street = "gameover";
    s.toAct = null;
    return;
  }
  s.handNo++;
  const lvl = s.settings.blindLevelHands;
  if (lvl > 0 && s.handNo > 1 && (s.handNo - 1) % lvl === 0) {
    s.bb *= 2;
    s.sb = s.bb / 2;
    pushLog(s, `Blinds are now ${fmt(s.sb)}/${fmt(s.bb)}`);
  }
  s.dealer = s.handNo === 1 && s.dealer < 0 ? next(s, randomInt(s.players.length), (p) => !p.out) : next(s, s.dealer, (p) => !p.out);
  for (const p of s.players) {
    Object.assign(p, { hole: [], bet: 0, total: 0, folded: p.out, allIn: false, acted: false, revealed: false, lastAction: null });
  }
  s.deck = shuffle(buildDeck());
  s.board = [];
  s.result = null;
  s.runout = false;
  s.street = "preflop";

  if (alive.length === 2) {
    s.sbIdx = s.dealer;
    s.bbIdx = next(s, s.dealer, (p) => !p.out);
  } else {
    s.sbIdx = next(s, s.dealer, (p) => !p.out);
    s.bbIdx = next(s, s.sbIdx, (p) => !p.out);
  }
  const sbP = s.players[s.sbIdx];
  const bbP = s.players[s.bbIdx];
  pay(s, sbP, s.sb);
  sbP.lastAction = `SB ${fmt(sbP.bet)}`;
  pay(s, bbP, s.bb);
  bbP.lastAction = `BB ${fmt(bbP.bet)}`;
  s.currentBet = s.bb;
  s.minRaise = s.bb;

  for (let round = 0; round < 2; round++) {
    let i = s.sbIdx;
    for (let k = 0; k < alive.length; k++) {
      s.players[i].hole.push(s.deck.pop()!);
      i = next(s, i, (p) => !p.out);
    }
  }
  pushLog(s, `Hand #${s.handNo} — ${s.players[s.dealer].name} deals`);
  s.toAct = next(s, s.bbIdx, canAct);
  progress(s, true);
}

function needsToAct(s: PokerState, p: PPlayer) {
  return canAct(p) && (!p.acted || p.bet < s.currentBet);
}

function roundComplete(s: PokerState): boolean {
  const actors = s.players.filter(canAct);
  if (actors.length === 0) return true;
  if (actors.length === 1) {
    // Everyone else is all-in: nobody left to bet against once the lone player has matched.
    const maxOther = Math.max(0, ...s.players.filter((p) => inHand(p) && p !== actors[0]).map((p) => p.bet));
    if (actors[0].bet >= maxOther) return true;
  }
  return !s.players.some((p) => needsToAct(s, p));
}

/** Moves the hand forward after an action (or at the start of a hand). */
function progress(s: PokerState, fromStart = false) {
  const live = s.players.filter(inHand);
  if (live.length === 1) {
    awardUncontested(s, live[0]);
    return;
  }
  if (!roundComplete(s)) {
    const from = fromStart ? s.bbIdx : (s.toAct ?? s.dealer);
    const n = fromStart && s.toAct !== null && needsToAct(s, s.players[s.toAct]) ? s.toAct : next(s, from, (p) => needsToAct(s, p));
    s.toAct = n;
    return;
  }
  // Betting round over.
  for (const p of s.players) p.bet = 0;
  s.currentBet = 0;
  s.minRaise = s.bb;
  s.toAct = null;
  if (s.street === "river") {
    showdown(s);
    return;
  }
  if (s.players.filter(canAct).length <= 1) {
    // Everyone left is all-in: reveal and run the board out with a pause between streets.
    s.runout = true;
    for (const p of live) p.revealed = true;
    return;
  }
  nextStreet(s);
}

function nextStreet(s: PokerState) {
  if (s.street === "preflop") {
    deal(s, 3);
    s.street = "flop";
  } else if (s.street === "flop") {
    deal(s, 1);
    s.street = "turn";
  } else if (s.street === "turn") {
    deal(s, 1);
    s.street = "river";
  }
  for (const p of s.players) {
    p.acted = false;
    if (!p.folded && !p.allIn && !p.out) p.lastAction = null;
  }
  if (s.runout) return;
  s.toAct = next(s, s.dealer, canAct);
}

function awardUncontested(s: PokerState, winner: PPlayer) {
  const pot = s.players.reduce((a, p) => a + p.total, 0);
  winner.chips += pot;
  for (const p of s.players) p.bet = 0;
  s.result = {
    showdown: false,
    pots: [{ amount: pot, winners: [winner.id], handName: null }],
    won: { [winner.id]: pot },
    handNames: {},
    bestCards: {},
  };
  pushLog(s, `${winner.name} wins ${fmt(pot)} uncontested`);
  s.street = "handover";
  s.toAct = null;
}

function showdown(s: PokerState) {
  const live = s.players.filter(inHand);
  const values = new Map(live.map((p) => [p.id, evaluate([...p.hole, ...s.board])]));
  for (const p of live) p.revealed = true;

  const levels = [...new Set(live.map((p) => p.total))].sort((a, b) => a - b);
  const pots: { amount: number; eligible: PPlayer[] }[] = [];
  let prev = 0;
  for (const L of levels) {
    const amount = s.players.reduce((a, p) => a + Math.min(p.total, L) - Math.min(p.total, prev), 0);
    const eligible = live.filter((p) => p.total >= L);
    const last = pots[pots.length - 1];
    if (last && last.eligible.length === eligible.length) last.amount += amount;
    else if (amount > 0) pots.push({ amount, eligible });
    prev = L;
  }

  const won: Record<string, number> = {};
  const potResults: PotResult[] = [];
  for (const pot of pots) {
    const best = Math.max(...pot.eligible.map((p) => values.get(p.id)!.score));
    const winners = pot.eligible.filter((p) => values.get(p.id)!.score === best);
    const share = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - share * winners.length;
    // Odd chips go to the first winner clockwise from the button.
    const ordered = [...winners].sort(
      (a, b) =>
        ((s.players.indexOf(a) - s.dealer - 1 + s.players.length) % s.players.length) -
        ((s.players.indexOf(b) - s.dealer - 1 + s.players.length) % s.players.length),
    );
    for (const w of ordered) {
      const amt = share + (odd-- > 0 ? 1 : 0);
      w.chips += amt;
      won[w.id] = (won[w.id] ?? 0) + amt;
    }
    potResults.push({
      amount: pot.amount,
      winners: winners.map((w) => w.id),
      handName: pot.eligible.length > 1 ? values.get(winners[0].id)!.name : null,
    });
  }
  const handNames: Record<string, string> = {};
  const bestCards: Record<string, string[]> = {};
  for (const [id, v] of values) {
    handNames[id] = v.name;
    bestCards[id] = v.cards;
  }
  for (const [id, amt] of Object.entries(won)) {
    const p = s.players.find((x) => x.id === id)!;
    const contested = potResults.some((r) => r.winners.includes(id) && r.handName);
    pushLog(s, `${p.name} wins ${fmt(amt)}${contested ? ` with ${handNames[id]}` : ""}`);
  }
  s.result = { showdown: true, pots: potResults, won, handNames, bestCards };
  s.street = "handover";
  s.toAct = null;
}

function legal(s: PokerState, p: PPlayer) {
  const callAmount = Math.min(s.currentBet - p.bet, p.chips);
  const maxRaiseTo = p.bet + p.chips;
  const minRaiseTo = Math.min(s.currentBet + s.minRaise, maxRaiseTo);
  const othersCanRespond = s.players.some((o) => o !== p && canAct(o));
  return {
    canCheck: p.bet >= s.currentBet,
    canCall: s.currentBet > p.bet,
    callAmount,
    canRaise: !p.acted && maxRaiseTo > s.currentBet && othersCanRespond,
    minRaiseTo,
    maxRaiseTo,
    currentBet: s.currentBet,
    myBet: p.bet,
  };
}

// ---------- Bot ----------

function equity(hole: Card[], board: Card[], opponents: number, sims = 220): number {
  const known = new Set([...hole, ...board].map((c) => c.id));
  const rest = buildDeck().filter((c) => !known.has(c.id));
  let score = 0;
  for (let t = 0; t < sims; t++) {
    // Partial Fisher–Yates: only shuffle as many cards as we need.
    const need = 5 - board.length + opponents * 2;
    for (let i = 0; i < need; i++) {
      const j = i + randomInt(rest.length - i);
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    let k = 0;
    const fullBoard = [...board];
    while (fullBoard.length < 5) fullBoard.push(rest[k++]);
    const mine = quickScore([...hole, ...fullBoard]);
    let beaten = false;
    let ties = 0;
    for (let o = 0; o < opponents; o++) {
      const theirs = quickScore([rest[k++], rest[k++], ...fullBoard]);
      if (theirs > mine) {
        beaten = true;
        break;
      }
      if (theirs === mine) ties++;
    }
    if (!beaten) score += 1 / (ties + 1);
  }
  return score / sims;
}

function botDecision(s: PokerState, p: PPlayer): PokerAction {
  const L = legal(s, p);
  const opponents = s.players.filter((o) => inHand(o) && o !== p).length;
  const pot = s.players.reduce((a, o) => a + o.total, 0);
  const eq = equity(p.hole, s.board, Math.max(1, opponents), s.board.length === 0 ? 160 : 220);
  const rel = eq * (opponents + 1); // > 1 means better than an average hand
  const r = Math.random();
  // Each bot gets a stable temperament from its id.
  const temper = (p.id.charCodeAt(p.id.length - 1) % 5) / 10; // 0 … 0.4 aggression
  const sizeTo = (fraction: number) => {
    const target = s.currentBet + Math.max(s.minRaise, Math.round((pot * fraction) / s.bb) * s.bb);
    return Math.max(L.minRaiseTo, Math.min(L.maxRaiseTo, target));
  };

  if (L.canCheck) {
    if (L.canRaise && (rel > 1.9 - temper || (rel > 1.3 && r < 0.35 + temper) || r < 0.06 + temper / 4)) {
      const to = sizeTo(0.45 + Math.random() * 0.5);
      return to >= L.maxRaiseTo ? { type: "allin" } : { type: "raise", to };
    }
    return { type: "check" };
  }

  const potOdds = L.callAmount / (pot + L.callAmount);
  const committed = L.callAmount >= p.chips * 0.6;
  if (L.canRaise && rel > 2.2 - temper && r < 0.55 + temper) {
    const to = sizeTo(0.6 + Math.random() * 0.6);
    return to >= L.maxRaiseTo || (committed && rel > 2.4) ? { type: "allin" } : { type: "raise", to };
  }
  const cheap = L.callAmount <= s.bb && rel > 0.55;
  if (eq > potOdds + (committed ? 0.12 : 0.02) || cheap) return { type: "call" };
  if (L.canRaise && r < 0.025 + temper / 10 && !committed) return { type: "raise", to: sizeTo(0.7) };
  return { type: "fold" };
}

// ---------- Engine ----------

export const pokerEngine: Engine<PokerState, PokerAction, PokerView, PokerSettings> = {
  id: "poker",
  minPlayers: 2,
  maxPlayers: 8,
  defaultSettings: { startingChips: 1000, bigBlind: 20, blindLevelHands: 10 },

  init(seats: SeatInfo[], settings: PokerSettings): PokerState {
    const s: PokerState = {
      settings,
      players: seats.map((x) => ({
        id: x.id,
        name: x.name,
        isBot: x.isBot,
        chips: settings.startingChips,
        hole: [],
        bet: 0,
        total: 0,
        folded: false,
        allIn: false,
        out: false,
        acted: false,
        revealed: false,
        lastAction: null,
      })),
      dealer: -1,
      sbIdx: 0,
      bbIdx: 0,
      sb: settings.bigBlind / 2,
      bb: settings.bigBlind,
      handNo: 0,
      deck: [],
      board: [],
      street: "preflop",
      toAct: null,
      currentBet: 0,
      minRaise: settings.bigBlind,
      runout: false,
      result: null,
      log: [],
      bustOrder: [],
      seq: 0,
    };
    startHand(s);
    return s;
  },

  act(s, playerId, a) {
    if (s.toAct === null || s.players[s.toAct].id !== playerId) throw new GameError("It's not your turn");
    const p = s.players[s.toAct];
    const L = legal(s, p);
    switch (a.type) {
      case "fold":
        p.folded = true;
        p.lastAction = "Fold";
        pushLog(s, `${p.name} folds`);
        break;
      case "check":
        if (!L.canCheck) throw new GameError("You can't check — there's a bet to call");
        p.lastAction = "Check";
        pushLog(s, `${p.name} checks`);
        break;
      case "call": {
        if (!L.canCall) throw new GameError("Nothing to call");
        const paid = pay(s, p, L.callAmount);
        p.lastAction = p.allIn ? "All-in" : `Call ${fmt(paid)}`;
        pushLog(s, `${p.name} ${p.allIn ? "calls all-in" : "calls"} ${fmt(paid)}`);
        break;
      }
      case "raise":
      case "allin": {
        let to = a.type === "allin" ? L.maxRaiseTo : Math.floor(a.to);
        if (a.type === "allin" && to <= s.currentBet) {
          const paid = pay(s, p, L.callAmount);
          p.lastAction = "All-in";
          pushLog(s, `${p.name} calls all-in ${fmt(paid)}`);
          break;
        }
        if (!L.canRaise) throw new GameError(L.maxRaiseTo <= s.currentBet ? "You don't have enough chips to raise" : "You can only call or fold here");
        to = Math.min(to, L.maxRaiseTo);
        if (to < L.minRaiseTo && to < L.maxRaiseTo) throw new GameError(`Minimum raise is to ${fmt(L.minRaiseTo)}`);
        if (to <= s.currentBet) throw new GameError("A raise must be more than the current bet");
        const wasBet = s.currentBet === 0;
        pay(s, p, to - p.bet);
        const increment = to - s.currentBet;
        if (increment >= s.minRaise) {
          s.minRaise = increment;
          for (const o of s.players) if (o !== p && canAct(o)) o.acted = false;
        }
        s.currentBet = to;
        p.lastAction = p.allIn ? "All-in" : wasBet ? `Bet ${fmt(to)}` : `Raise ${fmt(to)}`;
        pushLog(s, `${p.name} ${p.allIn ? "goes all-in for" : wasBet ? "bets" : "raises to"} ${fmt(to)}`);
        break;
      }
      default:
        throw new GameError("Unknown action");
    }
    p.acted = true;
    s.seq++;
    progress(s);
  },

  view(s, playerId): PokerView {
    const showAll = s.street === "gameover";
    const me = s.players.find((p) => p.id === playerId);
    return {
      game: "poker",
      players: s.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        out: p.out,
        lastAction: p.lastAction,
        cards: p.hole.map((c) => (p.id === playerId || p.revealed || showAll ? c : null)),
        isDealer: i === s.dealer,
        isSB: i === s.sbIdx && s.street !== "gameover",
        isBB: i === s.bbIdx && s.street !== "gameover",
      })),
      board: s.board,
      pot: s.players.reduce((a, p) => a + p.total, 0),
      street: s.street,
      toActId: s.toAct !== null ? s.players[s.toAct].id : null,
      handNo: s.handNo,
      sb: s.sb,
      bb: s.bb,
      result: s.result,
      runout: s.runout,
      log: s.log.slice(-25),
      myHandName: me && me.hole.length && s.board.length >= 3 && !me.folded ? evaluate([...me.hole, ...s.board]).name : null,
      actions: me && s.toAct !== null && s.players[s.toAct] === me ? legal(s, me) : null,
      standings:
        s.street === "gameover"
          ? [...s.players]
              .sort((a, b) => b.chips - a.chips || s.bustOrder.indexOf(b.id) - s.bustOrder.indexOf(a.id))
              .map((p) => ({ id: p.id, name: p.name, chips: p.chips }))
          : null,
    };
  },

  actor(s) {
    return s.toAct !== null ? s.players[s.toAct].id : null;
  },

  turnKey(s) {
    return s.toAct !== null ? `${s.handNo}:${s.seq}:${s.street}` : null;
  },

  botAct(s, playerId) {
    const p = s.players.find((x) => x.id === playerId)!;
    return botDecision(s, p);
  },

  timeoutActs(s, playerId) {
    const p = s.players.find((x) => x.id === playerId)!;
    return [legal(s, p).canCheck ? { type: "check" } : { type: "fold" }];
  },

  pendingAdvance(s) {
    if (s.runout) return 1400;
    if (s.street === "handover") return s.result?.showdown ? 6500 : 3500;
    return null;
  },

  advance(s) {
    if (s.runout) {
      if (s.street === "river") {
        s.runout = false;
        showdown(s);
      } else nextStreet(s);
      return;
    }
    if (s.street === "handover") startHand(s);
  },

  isOver(s) {
    return s.street === "gameover";
  },

  setBot(s, playerId) {
    const p = s.players.find((x) => x.id === playerId);
    if (p) p.isBot = true;
  },
};
