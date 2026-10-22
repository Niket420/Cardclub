import { pick, randomInt, shuffle } from "../cards";
import { Engine, GameError, SeatInfo } from "../types";

export type UnoColor = "R" | "Y" | "G" | "B";
export type UnoValue = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "skip" | "reverse" | "draw2" | "wild" | "wild4";

export interface UnoCard {
  id: string;
  color: UnoColor | "W";
  value: UnoValue;
}

export interface UnoSettings {
  /** First to this many points wins; 0 plays a single round. */
  target: number;
  /** Allow +2 on +2 and +4 on +2/+4, passing the total along. */
  stacking: boolean;
}

export type UnoAction =
  | { type: "play"; cardId: string; color?: UnoColor }
  | { type: "draw" }
  | { type: "pass" }
  | { type: "uno" }
  | { type: "catch"; targetId: string };

interface UPlayer {
  id: string;
  name: string;
  isBot: boolean;
  hand: UnoCard[];
  score: number;
  calledUno: boolean;
}

export interface UnoRoundResult {
  winnerId: string;
  points: number;
  hands: { id: string; name: string; cards: UnoCard[]; points: number }[];
}

export interface UnoState {
  settings: UnoSettings;
  players: UPlayer[];
  deck: UnoCard[];
  discard: UnoCard[];
  color: UnoColor;
  turn: number;
  dir: 1 | -1;
  pendingDraw: number;
  drawnCardId: string | null;
  vulnerable: string | null;
  dealer: number;
  roundNo: number;
  phase: "play" | "roundover" | "gameover";
  result: UnoRoundResult | null;
  log: string[];
}

export interface UnoView {
  game: "uno";
  players: { id: string; name: string; isBot: boolean; cardCount: number; score: number; calledUno: boolean; isDealer: boolean }[];
  hand: UnoCard[];
  playable: string[];
  discard: UnoCard[];
  color: UnoColor;
  dir: 1 | -1;
  turnId: string | null;
  pendingDraw: number;
  drawnCardId: string | null;
  deckCount: number;
  vulnerable: string | null;
  canCallUno: boolean;
  phase: UnoState["phase"];
  roundNo: number;
  target: number;
  stacking: boolean;
  result: UnoRoundResult | null;
  log: string[];
  standings: { id: string; name: string; score: number; cardsLeft: number }[] | null;
}

export const COLORS: UnoColor[] = ["R", "Y", "G", "B"];
export const COLOR_NAME: Record<UnoColor, string> = { R: "Red", Y: "Yellow", G: "Green", B: "Blue" };

export function unoCardLabel(c: UnoCard): string {
  const v: Record<string, string> = { skip: "Skip", reverse: "Reverse", draw2: "+2", wild: "Wild", wild4: "Wild +4" };
  const name = v[c.value] ?? c.value;
  return c.color === "W" ? name : `${COLOR_NAME[c.color]} ${name}`;
}

export function unoPoints(c: UnoCard): number {
  if (c.value === "wild" || c.value === "wild4") return 50;
  if (c.value === "skip" || c.value === "reverse" || c.value === "draw2") return 20;
  return Number(c.value);
}

function buildUnoDeck(): UnoCard[] {
  const out: UnoCard[] = [];
  let n = 0;
  for (const color of COLORS) {
    out.push({ id: `u${n++}`, color, value: "0" });
    for (const value of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2"] as UnoValue[]) {
      out.push({ id: `u${n++}`, color, value }, { id: `u${n++}`, color, value });
    }
  }
  for (let i = 0; i < 4; i++) out.push({ id: `u${n++}`, color: "W", value: "wild" }, { id: `u${n++}`, color: "W", value: "wild4" });
  return out;
}

function pushLog(s: UnoState, line: string) {
  s.log.push(line);
  if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
}

const top = (s: UnoState) => s.discard[s.discard.length - 1];

function step(s: UnoState, from: number, k = 1) {
  const n = s.players.length;
  return (((from + s.dir * k) % n) + n) % n;
}

function drawCards(s: UnoState, p: UPlayer, count: number): UnoCard[] {
  const got: UnoCard[] = [];
  for (let i = 0; i < count; i++) {
    if (s.deck.length === 0) {
      const t = s.discard.pop()!;
      s.deck = shuffle(s.discard);
      s.discard = [t];
      if (s.deck.length === 0) break;
    }
    got.push(s.deck.pop()!);
  }
  p.hand.push(...got);
  if (p.hand.length > 1) p.calledUno = false;
  return got;
}

function isPlayable(s: UnoState, p: UPlayer, c: UnoCard): boolean {
  if (s.drawnCardId && c.id !== s.drawnCardId) return false;
  const t = top(s);
  if (s.pendingDraw > 0) {
    if (c.value === "wild4") return true;
    return c.value === "draw2" && t.value === "draw2";
  }
  if (c.value === "wild") return true;
  if (c.value === "wild4") return !p.hand.some((x) => x.color === s.color);
  return c.color === s.color || c.value === t.value;
}

function startRound(s: UnoState) {
  s.roundNo++;
  s.dealer = s.roundNo === 1 ? randomInt(s.players.length) : (s.dealer + 1) % s.players.length;
  s.deck = shuffle(buildUnoDeck());
  s.discard = [];
  s.dir = 1;
  s.pendingDraw = 0;
  s.drawnCardId = null;
  s.vulnerable = null;
  s.result = null;
  s.phase = "play";
  for (const p of s.players) {
    p.hand = [];
    p.calledUno = false;
  }
  for (let r = 0; r < 7; r++) for (const p of s.players) p.hand.push(s.deck.pop()!);
  // Wild cards can't start the pile: put them back and turn up another.
  let first = s.deck.pop()!;
  while (first.color === "W") {
    s.deck.splice(randomInt(s.deck.length), 0, first);
    first = s.deck.pop()!;
  }
  s.discard.push(first);
  s.color = first.color as UnoColor;
  s.turn = step(s, s.dealer);
  pushLog(s, `Round ${s.roundNo} — ${s.players[s.dealer].name} deals`);
  if (first.value === "skip") {
    pushLog(s, `${s.players[s.turn].name} is skipped`);
    s.turn = step(s, s.turn);
  } else if (first.value === "reverse") {
    s.dir = -1;
    s.turn = s.dealer;
  } else if (first.value === "draw2") {
    const p = s.players[s.turn];
    drawCards(s, p, 2);
    pushLog(s, `${p.name} draws 2 and is skipped`);
    s.turn = step(s, s.turn);
  }
}

function endRound(s: UnoState, winner: UPlayer) {
  const hands = s.players
    .filter((p) => p !== winner)
    .map((p) => ({ id: p.id, name: p.name, cards: p.hand, points: p.hand.reduce((a, c) => a + unoPoints(c), 0) }))
    .sort((a, b) => a.points - b.points);
  const points = hands.reduce((a, h) => a + h.points, 0);
  winner.score += points;
  s.result = { winnerId: winner.id, points, hands };
  s.vulnerable = null;
  s.drawnCardId = null;
  pushLog(s, `${winner.name} wins the round (+${points})`);
  const over = s.settings.target <= 0 || winner.score >= s.settings.target;
  s.phase = over ? "gameover" : "roundover";
}

function closeUnoWindow(s: UnoState, actor: UPlayer) {
  if (s.vulnerable && s.vulnerable !== actor.id) s.vulnerable = null;
}

function bestColor(hand: UnoCard[]): UnoColor {
  const counts: Record<string, number> = { R: 0, Y: 0, G: 0, B: 0 };
  for (const c of hand) if (c.color !== "W") counts[c.color] += 1 + unoPoints(c) / 40;
  const best = COLORS.reduce((a, b) => (counts[b] > counts[a] ? b : a));
  return counts[best] > 0 ? best : pick(COLORS);
}

export const unoEngine: Engine<UnoState, UnoAction, UnoView, UnoSettings> = {
  id: "uno",
  minPlayers: 2,
  maxPlayers: 8,
  defaultSettings: { target: 0, stacking: false },

  init(seats: SeatInfo[], settings: UnoSettings): UnoState {
    const s: UnoState = {
      settings,
      players: seats.map((x) => ({ id: x.id, name: x.name, isBot: x.isBot, hand: [], score: 0, calledUno: false })),
      deck: [],
      discard: [],
      color: "R",
      turn: 0,
      dir: 1,
      pendingDraw: 0,
      drawnCardId: null,
      vulnerable: null,
      dealer: 0,
      roundNo: 0,
      phase: "play",
      result: null,
      log: [],
    };
    startRound(s);
    return s;
  },

  act(s, playerId, a) {
    if (s.phase !== "play") throw new GameError("The round is over");
    const p = s.players.find((x) => x.id === playerId);
    if (!p) throw new GameError("You're not in this game");

    if (a.type === "uno") {
      if (p.hand.length > 2) throw new GameError("You can only call UNO with two cards or fewer");
      if (p.hand.length === 2 && s.players[s.turn] !== p) throw new GameError("Call UNO as you play your second-to-last card");
      p.calledUno = true;
      if (s.vulnerable === p.id) s.vulnerable = null;
      pushLog(s, `${p.name} calls UNO!`);
      return;
    }
    if (a.type === "catch") {
      if (s.vulnerable !== a.targetId || a.targetId === p.id) throw new GameError("Too late — nobody to catch");
      const target = s.players.find((x) => x.id === a.targetId)!;
      drawCards(s, target, 2);
      s.vulnerable = null;
      pushLog(s, `${p.name} caught ${target.name} without UNO! +2 cards`);
      return;
    }

    if (s.players[s.turn] !== p) throw new GameError("It's not your turn");
    const n = s.players.length;

    if (a.type === "draw") {
      if (s.drawnCardId) throw new GameError("You've already drawn — play it or pass");
      closeUnoWindow(s, p);
      if (s.pendingDraw > 0) {
        const count = s.pendingDraw;
        drawCards(s, p, count);
        s.pendingDraw = 0;
        pushLog(s, `${p.name} draws ${count}`);
        s.turn = step(s, s.turn);
        return;
      }
      const [card] = drawCards(s, p, 1);
      if (card && isPlayable(s, p, card)) {
        s.drawnCardId = card.id;
        pushLog(s, `${p.name} draws a card`);
      } else {
        pushLog(s, `${p.name} draws and passes`);
        s.turn = step(s, s.turn);
      }
      return;
    }

    if (a.type === "pass") {
      if (!s.drawnCardId) throw new GameError("Draw a card before passing");
      s.drawnCardId = null;
      pushLog(s, `${p.name} passes`);
      s.turn = step(s, s.turn);
      return;
    }

    if (a.type !== "play") throw new GameError("Unknown action");
    const idx = p.hand.findIndex((c) => c.id === a.cardId);
    if (idx < 0) throw new GameError("That card isn't in your hand");
    const card = p.hand[idx];
    if (!isPlayable(s, p, card)) {
      if (card.value === "wild4" && s.pendingDraw === 0)
        throw new GameError("Wild +4 can only be played when you have no card of the current color");
      if (s.pendingDraw > 0) throw new GameError(`Stack a ${s.settings.stacking ? "+2 or +4" : "card"} or draw ${s.pendingDraw}`);
      throw new GameError("That card doesn't match the color or symbol");
    }
    if (card.color === "W" && !a.color) throw new GameError("Choose a color");
    closeUnoWindow(s, p);
    p.hand.splice(idx, 1);
    s.discard.push(card);
    s.color = card.color === "W" ? a.color! : card.color;
    s.drawnCardId = null;
    pushLog(s, `${p.name} plays ${card.color === "W" ? `${unoCardLabel(card)} → ${COLOR_NAME[s.color]}` : unoCardLabel(card)}`);

    if (p.hand.length === 1 && !p.calledUno) s.vulnerable = p.id;

    const nextIdx = step(s, s.turn);
    const nextP = s.players[nextIdx];
    const drawAmt = card.value === "draw2" ? 2 : card.value === "wild4" ? 4 : 0;

    if (p.hand.length === 0) {
      if (drawAmt || s.pendingDraw) {
        const count = s.pendingDraw + drawAmt;
        drawCards(s, nextP, count);
        pushLog(s, `${nextP.name} draws ${count}`);
        s.pendingDraw = 0;
      }
      endRound(s, p);
      return;
    }

    if (drawAmt) {
      if (s.settings.stacking) {
        s.pendingDraw += drawAmt;
        s.turn = nextIdx;
      } else {
        drawCards(s, nextP, drawAmt);
        pushLog(s, `${nextP.name} draws ${drawAmt} and is skipped`);
        s.turn = step(s, s.turn, 2);
      }
      return;
    }
    if (card.value === "skip" || (card.value === "reverse" && n === 2)) {
      pushLog(s, `${nextP.name} is skipped`);
      s.turn = step(s, s.turn, 2);
      return;
    }
    if (card.value === "reverse") {
      s.dir = s.dir === 1 ? -1 : 1;
      pushLog(s, "Direction reversed");
    }
    s.turn = step(s, s.turn);
  },

  view(s, playerId): UnoView {
    const me = s.players.find((p) => p.id === playerId);
    const myTurn = s.phase === "play" && !!me && s.players[s.turn] === me;
    return {
      game: "uno",
      players: s.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        cardCount: p.hand.length,
        score: p.score,
        calledUno: p.calledUno && p.hand.length <= 2,
        isDealer: i === s.dealer,
      })),
      hand: me?.hand ?? [],
      playable: myTurn && me ? me.hand.filter((c) => isPlayable(s, me, c)).map((c) => c.id) : [],
      discard: s.discard.slice(-5),
      color: s.color,
      dir: s.dir,
      turnId: s.phase === "play" ? s.players[s.turn].id : null,
      pendingDraw: s.pendingDraw,
      drawnCardId: myTurn ? s.drawnCardId : null,
      deckCount: s.deck.length,
      vulnerable: s.vulnerable,
      canCallUno:
        !!me && s.phase === "play" && !me.calledUno && (me.hand.length === 1 ? s.vulnerable === me.id : me.hand.length === 2 && myTurn),
      phase: s.phase,
      roundNo: s.roundNo,
      target: s.settings.target,
      stacking: s.settings.stacking,
      result: s.result,
      log: s.log.slice(-25),
      standings:
        s.phase === "gameover"
          ? [...s.players]
              .map((p) => ({ id: p.id, name: p.name, score: p.score, cardsLeft: p.hand.length, left: p.hand.reduce((a, c) => a + unoPoints(c), 0) }))
              .sort((a, b) => b.score - a.score || a.left - b.left)
              .map(({ id, name, score, cardsLeft }) => ({ id, name, score, cardsLeft }))
          : null,
    };
  },

  actor(s) {
    return s.phase === "play" ? s.players[s.turn].id : null;
  },

  turnKey(s) {
    return s.phase === "play" ? `${s.roundNo}:${s.turn}:${s.discard.length}:${s.pendingDraw}` : null;
  },

  botAct(s, playerId): UnoAction {
    const p = s.players.find((x) => x.id === playerId)!;
    const playable = p.hand.filter((c) => isPlayable(s, p, c));
    if (s.drawnCardId) {
      const c = p.hand.find((x) => x.id === s.drawnCardId)!;
      return c.color === "W" ? { type: "play", cardId: c.id, color: bestColor(p.hand.filter((x) => x !== c)) } : { type: "play", cardId: c.id };
    }
    if (!playable.length) return { type: "draw" };
    if (p.hand.length === 2 && !p.calledUno && Math.random() < 0.85) return { type: "uno" };

    const next = s.players[step(s, s.turn)];
    const threat = next.hand.length <= 2;
    const colorCount = (col: string) => p.hand.filter((x) => x.color === col).length;
    const rate = (c: UnoCard) => {
      let v = unoPoints(c) / 10 + colorCount(c.color) * 1.5;
      if (c.color === "W") v = threat ? 12 : -8 + (p.hand.length <= 2 ? 15 : 0);
      if (threat && (c.value === "draw2" || c.value === "skip" || c.value === "reverse")) v += 10;
      return v + Math.random();
    };
    const card = playable.sort((a, b) => rate(b) - rate(a))[0];
    return card.color === "W"
      ? { type: "play", cardId: card.id, color: bestColor(p.hand.filter((x) => x !== card)) }
      : { type: "play", cardId: card.id };
  },

  timeoutActs(s): UnoAction[] {
    return s.drawnCardId ? [{ type: "pass" }] : [{ type: "draw" }, { type: "pass" }];
  },

  interrupt(s) {
    if (!s.vulnerable || s.phase !== "play") return null;
    const catchers = s.players.filter((p) => p.isBot && p.id !== s.vulnerable);
    if (!catchers.length) return null;
    const target = s.players.find((p) => p.id === s.vulnerable)!;
    return {
      playerId: pick(catchers).id,
      action: { type: "catch", targetId: target.id },
      key: `catch:${target.id}:${s.discard.length}:${s.log.length}`,
      delayMs: target.isBot ? 700 + randomInt(900) : 1600 + randomInt(1600),
    };
  },

  pendingAdvance(s) {
    return s.phase === "roundover" ? 9000 : null;
  },

  advance(s) {
    if (s.phase === "roundover") startRound(s);
  },

  isOver(s) {
    return s.phase === "gameover";
  },

  setBot(s, playerId) {
    const p = s.players.find((x) => x.id === playerId);
    if (p) p.isBot = true;
  },
};
