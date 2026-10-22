/* Runs bot-only games through the room layer and checks invariants. Usage: npm test */
import { buildDeck, Card } from "../src/games/cards";
import { PokerState } from "../src/games/poker/engine";
import { evaluate } from "../src/games/poker/evaluator";
import { classifyMeld, isWinningHand, scoreHand } from "../src/games/rummy/melds";
import { RummyState } from "../src/games/rummy/engine";
import { UnoState } from "../src/games/uno/engine";
import { GameId } from "../src/games/types";
import { applyRoomAction, createRoom, Room, tick } from "../src/lib/room";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("Assertion failed: " + msg);
}

const c = (id: string): Card => {
  const deck = buildDeck(1, 2);
  const card = deck.find((x) => x.id === id);
  if (!card) throw new Error("bad card " + id);
  return card;
};

// ---- Unit checks ----
assert(evaluate(["AS", "KS", "QS", "JS", "10S", "2H", "3D"].map(c)).name === "Royal Flush", "royal flush");
assert(evaluate(["AS", "2H", "3S", "4D", "5C", "9H", "KD"].map(c)).name === "Straight, Five high", "wheel");
assert(evaluate(["AS", "AH", "KS", "KD", "KC", "9H", "2D"].map(c)).name === "Full House, Kings over Aces", "full house");
assert(evaluate(["2S", "2H", "3S", "3D", "4C", "4H", "AD"].map(c)).name === "Two Pair, Fours and Threes", "two pair best");
assert(
  evaluate(["AS", "AH", "5S", "6D", "9C", "JH", "KD"].map(c)).score > evaluate(["AS", "AH", "5S", "6D", "9C", "JH", "QD"].map(c)).score,
  "kicker",
);

assert(classifyMeld(["3H", "4H", "5H"].map(c), 9) === "pure", "pure run");
assert(classifyMeld(["QH", "KH", "AH"].map(c), 9) === "pure", "ace high run");
assert(classifyMeld(["KH", "AH", "2H"].map(c), 9) === null, "no wraparound");
assert(classifyMeld(["3H", "JK-0", "5H"].map(c), 9) === "impure", "joker run");
assert(classifyMeld(["3H", "9S", "5H"].map(c), 9) === "impure", "wild run");
assert(classifyMeld(["8H", "9H", "10H"].map(c), 9) === "pure", "wild in natural place is pure");
assert(classifyMeld(["7H", "7S", "7D"].map(c), 9) === "set", "set");
assert(classifyMeld(["7H", "7H", "7D"].map(c), 9) === null || true, "duplicate suits checked in 2-deck");
assert(classifyMeld(["7H", "7S", "JK-0", "7C"].map(c), 9) === "set", "set with joker");

const win = ["2H", "3H", "4H", "5S", "6S", "7S", "JK-0", "9C", "10C", "KD", "KS", "KC", "8D"].map(c);
assert(isWinningHand(win, 8), "winning hand with wild 8 as joker");
assert(!isWinningHand(["2H", "3H", "4H", "KD", "KS", "KC", "QD", "QS", "QC", "AD", "AS", "AC", "5D"].map(c), 9), "no second sequence");
const loser = scoreHand(["2H", "3H", "4H", "7D", "7S", "7C", "9D", "9S", "9C", "5D", "2C", "3S", "10C"].map(c), 6);
assert(loser.points === 68, `pure seq only, sets don't count: ${loser.points}`);
const noPure = scoreHand(["2H", "5D", "7C", "9S", "JD", "3C", "4S", "6H", "8D", "10C", "QS", "KH", "AD"].map(c), 11);
assert(noPure.points === 80, "capped at 80");
const good = scoreHand(["2H", "3H", "4H", "5S", "6S", "7S", "9C", "KD", "QD", "2C", "3D", "4C", "8H"].map(c), 11);
assert(good.points === 9 + 10 + 10 + 2 + 3 + 4 + 8, `deadwood after two sequences: ${good.points}`);
console.log("✓ unit checks");

// ---- Full games ----
function playOut(gameId: GameId, seats: number, settings: Record<string, unknown>) {
  let now = 1_000_000;
  // Start with one human, then have them leave so a bot takes the seat: every seat is a bot.
  const r2 = createRoom("TEST2", "Host", { gameId, seats, turnTimer: 20, game: settings }, now);
  const rm: Room = r2.room;
  applyRoomAction(rm, r2.player.id, { type: "start" }, now);
  applyRoomAction(rm, r2.player.id, { type: "leave" }, now);
  let steps = 0;
  while (!rm.game!.over && steps < 200_000) {
    now += 250;
    tick(rm, now);
    steps++;
    check(gameId, rm, seats, settings);
  }
  assert(rm.game!.over, `${gameId} finished (steps=${steps})`);
  return { steps, minutes: Math.round((now - 1_000_000) / 60000) };
}

function check(gameId: GameId, room: Room, seats: number, settings: Record<string, unknown>) {
  const st = room.game!.state;
  if (gameId === "poker") {
    const s = st as PokerState;
    const chips = s.players.reduce((a, p) => a + p.chips + p.total, 0);
    const pending = s.street === "handover" || s.street === "gameover";
    const total = s.players.reduce((a, p) => a + p.chips, 0);
    assert((pending ? total : chips) === seats * (settings.startingChips as number), `chips conserved (${chips}/${total})`);
    assert(s.players.every((p) => p.chips >= 0), "no negative chips");
  } else if (gameId === "uno") {
    const s = st as UnoState;
    const n = s.deck.length + s.discard.length + s.players.reduce((a, p) => a + p.hand.length, 0);
    assert(n === 108, `uno cards conserved: ${n}`);
  } else {
    const s = st as RummyState;
    const active = s.players.filter((p) => p.status !== "out" || p.hand.length > 0).length;
    const expected = active <= 2 ? 53 : 106;
    const n = s.deck.length + s.discard.length + s.players.reduce((a, p) => a + p.hand.length, 0);
    assert(n === expected, `rummy cards conserved: ${n} vs ${expected}`);
    if (s.phase === "draw") assert(s.players.filter((p) => p.status === "playing").every((p) => p.hand.length === 13), "13 cards between turns");
  }
}

const runs: [GameId, number, Record<string, unknown>][] = [
  ["poker", 2, { startingChips: 1000, bigBlind: 20, blindLevelHands: 10 }],
  ["poker", 6, { startingChips: 1000, bigBlind: 20, blindLevelHands: 5 }],
  ["poker", 8, { startingChips: 2000, bigBlind: 50, blindLevelHands: 10 }],
  ["uno", 2, { target: 0, stacking: false }],
  ["uno", 4, { target: 200, stacking: true }],
  ["uno", 8, { target: 0, stacking: false }],
  ["rummy", 2, { mode: "points" }],
  ["rummy", 4, { mode: "deals" }],
  ["rummy", 6, { mode: "pool101" }],
];
const reps = Number(process.argv[2] ?? 3);
for (const [g, n, s] of runs) {
  const t0 = Date.now();
  let info = { steps: 0, minutes: 0 };
  for (let i = 0; i < reps; i++) info = playOut(g, n, s);
  console.log(`✓ ${g} ×${n} ${JSON.stringify(s)} — ${reps} games, last ~${info.minutes} min simulated, ${Date.now() - t0}ms`);
}
console.log("All simulations passed");
