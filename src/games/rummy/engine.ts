import { buildDeck, Card, cardLabel, rankName, shuffle } from "../cards";
import { Engine, GameError, SeatInfo } from "../types";
import { arrangeWinning, botHandScore, cardPoints, isJoker, MeldKind, scoreHand } from "./melds";

export type RummyMode = "points" | "deals" | "pool101" | "pool201";

export interface RummySettings {
  mode: RummyMode;
}

export type RummyAction =
  | { type: "draw"; from: "deck" | "discard" }
  | { type: "discard"; cardId: string }
  | { type: "declare"; cardId: string }
  | { type: "drop" };

type Status = "playing" | "dropped" | "declared" | "invalid" | "out";

interface RPlayer {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
  status: Status;
  total: number;
  hasDrawn: boolean;
  lastDrawnId: string | null;
  pickedFromDiscardId: string | null;
  dealPoints: number | null;
}

export interface DealRow {
  id: string;
  name: string;
  status: Status;
  points: number;
  total: number;
  note: string;
  melds: { kind: MeldKind; cards: Card[] }[];
  loose: Card[];
}

export interface DealResult {
  winnerId: string | null;
  rows: DealRow[];
}

export interface RummyState {
  settings: RummySettings;
  players: RPlayer[];
  dealer: number;
  turn: number;
  phase: "draw" | "discard" | "dealover" | "gameover";
  deck: Card[];
  discard: Card[];
  /** Whether the top of the open pile was thrown by a player (vs. turned up at the deal). */
  topDiscardedByPlayer: string | null;
  wildRank: number;
  wildCard: Card | null;
  dealNo: number;
  /** Increments every time the turn passes. */
  turnNo: number;
  result: DealResult | null;
  log: string[];
}

export interface RummySeatView {
  id: string;
  name: string;
  isBot: boolean;
  cardCount: number;
  status: Status;
  total: number;
  isDealer: boolean;
}

export interface RummyView {
  game: "rummy";
  mode: RummyMode;
  players: RummySeatView[];
  hand: Card[];
  deckCount: number;
  discardTop: Card | null;
  discardCount: number;
  topDiscardedBy: string | null;
  wildRank: number;
  wildCard: Card | null;
  turnId: string | null;
  phase: RummyState["phase"];
  dealNo: number;
  totalDeals: number | null;
  poolLimit: number | null;
  canTakeDiscard: boolean;
  lastDrawnId: string | null;
  pickedFromDiscardId: string | null;
  dropCost: number;
  result: DealResult | null;
  log: string[];
  standings: { id: string; name: string; total: number }[] | null;
}

const POOL_LIMIT: Partial<Record<RummyMode, number>> = { pool101: 101, pool201: 201 };
const DEALS_COUNT = 3;

function dropCosts(mode: RummyMode) {
  return mode === "pool201" ? { first: 25, middle: 50 } : { first: 20, middle: 40 };
}

function pushLog(s: RummyState, line: string) {
  s.log.push(line);
  if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
}

const active = (p: RPlayer) => p.status === "playing";

function nextIdx(s: RummyState, from: number, pred: (p: RPlayer) => boolean) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (pred(s.players[i])) return i;
  }
  return -1;
}

function startDeal(s: RummyState) {
  const seated = s.players.filter((p) => p.status !== "out");
  s.dealNo++;
  s.dealer = s.dealNo === 1 ? nextIdx(s, Math.floor(Math.random() * s.players.length), (p) => p.status !== "out") : nextIdx(s, s.dealer, (p) => p.status !== "out");
  const decks = seated.length <= 2 ? 1 : 2;
  s.deck = shuffle(buildDeck(decks, decks));
  for (const p of s.players) {
    Object.assign(p, { hand: [], hasDrawn: false, lastDrawnId: null, pickedFromDiscardId: null, dealPoints: null });
    if (p.status !== "out") p.status = "playing";
  }
  const cut = s.deck.pop()!;
  s.wildCard = cut;
  s.wildRank = cut.rank === 0 ? 1 : cut.rank;
  s.deck.unshift(cut); // the cut card sits face up under the closed deck
  for (let r = 0; r < 13; r++) for (const p of seated) p.hand.push(s.deck.pop()!);
  s.discard = [s.deck.pop()!];
  s.topDiscardedByPlayer = null;
  s.result = null;
  s.phase = "draw";
  s.turn = nextIdx(s, s.dealer, active);
  pushLog(s, `Deal ${s.dealNo}: ${rankName(s.wildRank, true)} are wild`);
}

function advanceTurn(s: RummyState) {
  const me = s.players[s.turn];
  me.lastDrawnId = null;
  me.pickedFromDiscardId = null;
  if (s.players.filter(active).length === 1) {
    endDeal(s, s.players.find(active)!);
    return;
  }
  s.turn = nextIdx(s, s.turn, active);
  s.turnNo++;
  s.phase = "draw";
}

function endDeal(s: RummyState, winner: RPlayer | null) {
  const rows: DealRow[] = [];
  for (const p of s.players) {
    if (p.status === "out") continue;
    let row: DealRow;
    if (p === winner) {
      const scored = scoreHand(p.hand, s.wildRank);
      p.dealPoints = 0;
      row = {
        id: p.id,
        name: p.name,
        status: p.status,
        points: 0,
        total: 0,
        note: p.status === "declared" ? "Valid declaration" : "Last player standing",
        melds: scored.melds,
        loose: scored.loose,
      };
    } else if (p.status === "dropped" || p.status === "invalid") {
      row = {
        id: p.id,
        name: p.name,
        status: p.status,
        points: p.dealPoints ?? 0,
        total: 0,
        note: p.status === "dropped" ? "Dropped" : "Wrong declaration",
        melds: [],
        loose: p.hand,
      };
    } else {
      const scored = scoreHand(p.hand, s.wildRank);
      p.dealPoints = scored.points;
      row = { id: p.id, name: p.name, status: p.status, points: scored.points, total: 0, note: "", melds: scored.melds, loose: scored.loose };
    }
    p.total += p.dealPoints ?? 0;
    row.total = p.total;
    rows.push(row);
  }
  rows.sort((a, b) => a.points - b.points);
  s.result = { winnerId: winner?.id ?? null, rows };
  if (winner) pushLog(s, `${winner.name} wins deal ${s.dealNo}`);

  const limit = POOL_LIMIT[s.settings.mode];
  let over = false;
  if (limit) {
    for (const p of s.players) {
      if (p.status !== "out" && p.total >= limit) {
        p.status = "out";
        pushLog(s, `${p.name} is eliminated with ${p.total} points`);
      }
    }
    over = s.players.filter((p) => p.status !== "out").length <= 1;
  } else if (s.settings.mode === "points") over = true;
  else over = s.dealNo >= DEALS_COUNT;
  s.phase = over ? "gameover" : "dealover";
}

function drawFromDeck(s: RummyState): Card {
  if (s.deck.length === 0) {
    const top = s.discard.pop()!;
    s.deck = shuffle(s.discard);
    s.discard = [top];
    pushLog(s, "The closed deck was reshuffled");
  }
  return s.deck.pop()!;
}

function current(s: RummyState, playerId: string): RPlayer {
  if (s.phase !== "draw" && s.phase !== "discard") throw new GameError("The deal is over");
  const p = s.players[s.turn];
  if (p.id !== playerId) throw new GameError("It's not your turn");
  return p;
}

function takeCard(p: RPlayer, cardId: string): Card {
  const i = p.hand.findIndex((c) => c.id === cardId);
  if (i < 0) throw new GameError("That card isn't in your hand");
  return p.hand.splice(i, 1)[0];
}

function canTakeDiscard(s: RummyState): boolean {
  const top = s.discard[s.discard.length - 1];
  return !!top && !(isJoker(top, s.wildRank) && s.topDiscardedByPlayer);
}

/** Card to throw when a player times out. */
function fallbackDiscard(s: RummyState, p: RPlayer): string {
  if (p.lastDrawnId && p.lastDrawnId !== p.pickedFromDiscardId) return p.lastDrawnId;
  const options = p.hand.filter((c) => c.id !== p.pickedFromDiscardId && !isJoker(c, s.wildRank));
  options.sort((a, b) => cardPoints(b, s.wildRank) - cardPoints(a, s.wildRank));
  return (options[0] ?? p.hand[0]).id;
}

function bestDiscard(s: RummyState, hand: Card[], exclude: string | null): { id: string; score: number } {
  let best = { id: hand[0].id, score: Infinity };
  for (const c of hand) {
    if (c.id === exclude || isJoker(c, s.wildRank)) continue;
    const rest = hand.filter((x) => x !== c);
    const score = botHandScore(rest, s.wildRank) + (cardPoints(c, s.wildRank) ? 0 : 5) - cardPoints(c, s.wildRank) * 0.05;
    if (score < best.score) best = { id: c.id, score };
  }
  return best;
}

export const rummyEngine: Engine<RummyState, RummyAction, RummyView, RummySettings> = {
  id: "rummy",
  minPlayers: 2,
  maxPlayers: 6,
  defaultSettings: { mode: "pool101" },

  init(seats: SeatInfo[], settings: RummySettings): RummyState {
    const s: RummyState = {
      settings,
      players: seats.map((x) => ({
        id: x.id,
        name: x.name,
        isBot: x.isBot,
        hand: [],
        status: "playing",
        total: 0,
        hasDrawn: false,
        lastDrawnId: null,
        pickedFromDiscardId: null,
        dealPoints: null,
      })),
      dealer: 0,
      turn: 0,
      phase: "draw",
      deck: [],
      discard: [],
      topDiscardedByPlayer: null,
      wildRank: 1,
      wildCard: null,
      dealNo: 0,
      turnNo: 0,
      result: null,
      log: [],
    };
    startDeal(s);
    return s;
  },

  act(s, playerId, a) {
    const p = current(s, playerId);
    switch (a.type) {
      case "draw": {
        if (s.phase !== "draw") throw new GameError("You've already drawn a card");
        let card: Card;
        if (a.from === "discard") {
          if (!canTakeDiscard(s)) throw new GameError("A discarded joker can't be picked up");
          card = s.discard.pop()!;
          p.pickedFromDiscardId = card.id;
          pushLog(s, `${p.name} picks up ${cardLabel(card)}`);
        } else {
          card = drawFromDeck(s);
          pushLog(s, `${p.name} draws from the deck`);
        }
        // Whatever is now on top of the open pile was thrown by someone earlier.
        if (a.from === "discard") s.topDiscardedByPlayer = s.discard.length ? "pile" : null;
        p.hand.push(card);
        p.lastDrawnId = card.id;
        p.hasDrawn = true;
        s.phase = "discard";
        return;
      }
      case "discard": {
        if (s.phase !== "discard") throw new GameError("Draw a card first");
        const id = a.cardId === "$auto" ? fallbackDiscard(s, p) : a.cardId;
        if (id === p.pickedFromDiscardId) throw new GameError("You can't throw back the card you just picked up");
        const card = takeCard(p, id);
        s.discard.push(card);
        s.topDiscardedByPlayer = p.id;
        pushLog(s, `${p.name} discards ${cardLabel(card)}`);
        advanceTurn(s);
        return;
      }
      case "declare": {
        if (s.phase !== "discard") throw new GameError("Draw a card before declaring");
        const card = takeCard(p, a.cardId);
        s.discard.push(card);
        s.topDiscardedByPlayer = p.id;
        if (arrangeWinning(p.hand, s.wildRank)) {
          p.status = "declared";
          pushLog(s, `${p.name} declares!`);
          endDeal(s, p);
        } else {
          p.status = "invalid";
          p.dealPoints = 80;
          pushLog(s, `${p.name} made a wrong declaration (80 points)`);
          advanceTurn(s);
        }
        return;
      }
      case "drop": {
        if (s.phase !== "draw") throw new GameError("You can only drop at the start of your turn");
        const costs = dropCosts(s.settings.mode);
        p.dealPoints = p.hasDrawn ? costs.middle : costs.first;
        p.status = "dropped";
        pushLog(s, `${p.name} drops (${p.dealPoints} points)`);
        advanceTurn(s);
        return;
      }
      default:
        throw new GameError("Unknown action");
    }
  },

  view(s, playerId): RummyView {
    const me = s.players.find((p) => p.id === playerId);
    const playing = s.phase === "draw" || s.phase === "discard";
    const costs = dropCosts(s.settings.mode);
    const top = s.discard[s.discard.length - 1] ?? null;
    return {
      game: "rummy",
      mode: s.settings.mode,
      players: s.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        cardCount: p.hand.length,
        status: p.status,
        total: p.total,
        isDealer: i === s.dealer,
      })),
      hand: me ? me.hand : [],
      deckCount: s.deck.length,
      discardTop: top,
      discardCount: s.discard.length,
      topDiscardedBy: s.topDiscardedByPlayer,
      wildRank: s.wildRank,
      wildCard: s.wildCard,
      turnId: playing ? s.players[s.turn].id : null,
      phase: s.phase,
      dealNo: s.dealNo,
      totalDeals: s.settings.mode === "deals" ? DEALS_COUNT : s.settings.mode === "points" ? 1 : null,
      poolLimit: POOL_LIMIT[s.settings.mode] ?? null,
      canTakeDiscard: canTakeDiscard(s),
      lastDrawnId: me?.lastDrawnId ?? null,
      pickedFromDiscardId: me?.pickedFromDiscardId ?? null,
      dropCost: me?.hasDrawn ? costs.middle : costs.first,
      result: s.result,
      log: s.log.slice(-25),
      standings:
        s.phase === "gameover"
          ? [...s.players]
              .sort((a, b) => (a.status === "out" ? 1 : 0) - (b.status === "out" ? 1 : 0) || a.total - b.total)
              .map((p) => ({ id: p.id, name: p.name, total: p.total }))
          : null,
    };
  },

  actor(s) {
    return s.phase === "draw" || s.phase === "discard" ? s.players[s.turn].id : null;
  },

  turnKey(s) {
    return s.phase === "draw" || s.phase === "discard" ? `${s.dealNo}:${s.turnNo}` : null;
  },

  botAct(s, playerId): RummyAction {
    const p = s.players.find((x) => x.id === playerId)!;
    if (s.phase === "draw") {
      const top = s.discard[s.discard.length - 1];
      if (top && canTakeDiscard(s)) {
        if (isJoker(top, s.wildRank)) return { type: "draw", from: "discard" };
        const now = botHandScore(p.hand, s.wildRank);
        const withTop = bestDiscard(s, [...p.hand, top], top.id);
        if (withTop.score < now - 3) return { type: "draw", from: "discard" };
      }
      return { type: "draw", from: "deck" };
    }
    for (const c of p.hand) {
      if (c.id === p.pickedFromDiscardId) continue;
      const rest = p.hand.filter((x) => x !== c);
      if (arrangeWinning(rest, s.wildRank)) return { type: "declare", cardId: c.id };
    }
    return { type: "discard", cardId: bestDiscard(s, p.hand, p.pickedFromDiscardId).id };
  },

  timeoutActs(s): RummyAction[] {
    return s.phase === "draw"
      ? [{ type: "draw", from: "deck" }, { type: "discard", cardId: "$auto" }]
      : [{ type: "discard", cardId: "$auto" }];
  },

  pendingAdvance(s) {
    return s.phase === "dealover" ? 12000 : null;
  },

  advance(s) {
    if (s.phase === "dealover") startDeal(s);
  },

  isOver(s) {
    return s.phase === "gameover";
  },

  setBot(s, playerId) {
    const p = s.players.find((x) => x.id === playerId);
    if (p) p.isBot = true;
  },
};
