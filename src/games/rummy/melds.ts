import { Card, Suit } from "../cards";

export type MeldKind = "pure" | "impure" | "set";

export function isJoker(c: Card, wildRank: number): boolean {
  return c.suit === "X" || c.rank === wildRank;
}

/** Penalty value of an unmelded card. Jokers are free. */
export function cardPoints(c: Card, wildRank: number): number {
  if (isJoker(c, wildRank)) return 0;
  if (c.rank === 1 || c.rank >= 11) return 10;
  return c.rank;
}

function consecutive(sorted: number[]): boolean {
  for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + 1) return false;
  return true;
}

/**
 * Classifies a group of cards:
 * - pure: a run of 3+ cards of one suit with no joker standing in (a wild card in its natural spot is fine)
 * - impure: a run completed with jokers
 * - set: 3–4 cards of one rank in different suits (jokers may fill in)
 */
export function classifyMeld(cards: Card[], wildRank: number): MeldKind | null {
  const n = cards.length;
  if (n < 3) return null;

  if (cards.every((c) => c.suit !== "X") && new Set(cards.map((c) => c.suit)).size === 1) {
    const low = cards.map((c) => c.rank).sort((a, b) => a - b);
    const high = cards.map((c) => (c.rank === 1 ? 14 : c.rank)).sort((a, b) => a - b);
    if (consecutive(low) || consecutive(high)) return "pure";
  }

  const naturals = cards.filter((c) => !isJoker(c, wildRank));
  if (naturals.length === 0) return n <= 4 ? "set" : null;

  const suits = new Set(naturals.map((c) => c.suit));
  if (suits.size === 1 && n <= 13) {
    for (const aceHigh of [false, true]) {
      const ranks = naturals.map((c) => (aceHigh && c.rank === 1 ? 14 : c.rank));
      if (new Set(ranks).size !== ranks.length) continue;
      const span = Math.max(...ranks) - Math.min(...ranks) + 1;
      if (span <= n) return "impure";
    }
  }

  const ranks = new Set(naturals.map((c) => c.rank));
  if (ranks.size === 1 && n <= 4 && suits.size === naturals.length) return "set";
  return null;
}

export const MELD_LABEL: Record<MeldKind, string> = {
  pure: "Pure sequence",
  impure: "Sequence",
  set: "Set",
};

interface Meld {
  mask: number;
  kind: MeldKind;
}

function enumerateMelds(cards: Card[], wildRank: number): Meld[] {
  const jokers: number[] = [];
  cards.forEach((c, i) => isJoker(c, wildRank) && jokers.push(i));
  const pools: number[][] = [];
  for (const s of ["S", "H", "D", "C"] as Suit[]) {
    const own = cards.map((c, i) => (c.suit === s ? i : -1)).filter((i) => i >= 0);
    pools.push([...new Set([...own, ...jokers])]);
  }
  for (let r = 1; r <= 13; r++) {
    const own = cards.map((c, i) => (c.rank === r ? i : -1)).filter((i) => i >= 0);
    if (own.length) pools.push([...new Set([...own, ...jokers])]);
  }
  const seen = new Map<number, MeldKind>();
  for (const pool of pools) {
    if (pool.length < 3) continue;
    const total = 1 << pool.length;
    for (let sub = 0; sub < total; sub++) {
      let bits = 0;
      let mask = 0;
      for (let k = 0; k < pool.length; k++) {
        if (sub & (1 << k)) {
          bits++;
          mask |= 1 << pool[k];
        }
      }
      if (bits < 3 || seen.has(mask)) continue;
      const group = pool.filter((_, k) => sub & (1 << k)).map((i) => cards[i]);
      const kind = classifyMeld(group, wildRank);
      if (kind) seen.set(mask, kind);
    }
  }
  return [...seen.entries()].map(([mask, kind]) => ({ mask, kind }));
}

interface Solution {
  cost: number;
  melds: Meld[];
}

/**
 * Picks disjoint melds minimising (cost of loose cards + endCost(flags)).
 * flags track whether a pure sequence exists and how many sequences (capped at 2).
 */
function solve(
  n: number,
  melds: Meld[],
  cardCost: number[],
  endCost: (hasPure: boolean, seqs: number) => number,
): Solution {
  const byLowest: Meld[][] = Array.from({ length: n }, () => []);
  for (const m of melds) byLowest[31 - Math.clz32(m.mask & -m.mask)].push(m);
  const memo = new Map<number, Solution>();
  const full = (1 << n) - 1;

  const rec = (mask: number, pure: number, seqs: number): Solution => {
    if (mask === 0) return { cost: endCost(pure === 1, seqs), melds: [] };
    const key = mask * 6 + pure * 3 + seqs;
    const hit = memo.get(key);
    if (hit) return hit;
    const low = 31 - Math.clz32(mask & -mask);
    const rest = rec(mask & ~(1 << low), pure, seqs);
    let best: Solution = { cost: rest.cost + cardCost[low], melds: rest.melds };
    for (const m of byLowest[low]) {
      if ((m.mask & mask) !== m.mask) continue;
      const isSeq = m.kind !== "set";
      const sub = rec(mask & ~m.mask, m.kind === "pure" ? 1 : pure, isSeq ? Math.min(2, seqs + 1) : seqs);
      if (sub.cost < best.cost) best = { cost: sub.cost, melds: [m, ...sub.melds] };
    }
    memo.set(key, best);
    return best;
  };
  return rec(full, 0, 0);
}

const valid = (hasPure: boolean, seqs: number) => hasPure && seqs >= 2;

/** True if all cards can be laid down as a winning declaration. */
export function isWinningHand(cards: Card[], wildRank: number): boolean {
  return arrangeWinning(cards, wildRank) !== null;
}

export function arrangeWinning(cards: Card[], wildRank: number): Card[][] | null {
  const melds = enumerateMelds(cards, wildRank);
  const sol = solve(cards.length, melds, cards.map(() => 1000), (p, s) => (valid(p, s) ? 0 : 1e6));
  if (sol.cost !== 0) return null;
  return sol.melds.map((m) => maskCards(cards, m.mask));
}

function maskCards(cards: Card[], mask: number): Card[] {
  return cards.filter((_, i) => mask & (1 << i));
}

export interface ScoredHand {
  points: number;
  melds: { kind: MeldKind; cards: Card[] }[];
  loose: Card[];
}

/**
 * Penalty for a losing hand, arranged in the player's favour:
 * - pure sequence + another sequence: only unmelded cards count
 * - pure sequence only: everything except pure sequences counts
 * - no pure sequence: every card counts
 * Capped at 80.
 */
export function scoreHand(cards: Card[], wildRank: number): ScoredHand {
  const values = cards.map((c) => cardPoints(c, wildRank));
  // A tiny extra cost per loose card makes the solver meld free cards (jokers) too, for a tidier display.
  const costs = values.map((v) => v + 0.001);
  const total = values.reduce((a, b) => a + b, 0);
  const melds = enumerateMelds(cards, wildRank);
  const a = solve(cards.length, melds, costs, (p, s) => (valid(p, s) ? 0 : 1e6));
  const b = solve(
    cards.length,
    melds.filter((m) => m.kind === "pure"),
    costs,
    (p) => (p ? 0 : 1e6),
  );
  const pointsOf = (sol: Solution) => {
    const used = sol.melds.reduce((m, x) => m | x.mask, 0);
    return values.reduce((sum, v, i) => sum + (used & (1 << i) ? 0 : v), 0);
  };
  let pickSol: Solution | null = null;
  let points = total;
  for (const sol of [a, b]) {
    if (sol.cost >= 1e6) continue;
    const p = pointsOf(sol);
    if (p < points || (p === points && pickSol === null)) [points, pickSol] = [p, sol];
  }
  const used = pickSol ? pickSol.melds.reduce((m, x) => m | x.mask, 0) : 0;
  return {
    points: Math.min(80, points),
    melds: pickSol ? pickSol.melds.map((m) => ({ kind: m.kind, cards: orderMeld(maskCards(cards, m.mask), m.kind, wildRank) })) : [],
    loose: cards.filter((_, i) => !(used & (1 << i))),
  };
}

/** Lays a meld out the way a player would: runs in rank order with jokers in the gaps. */
export function orderMeld(cards: Card[], kind: MeldKind, wildRank: number): Card[] {
  if (kind === "set")
    return [...cards].sort((a, b) => Number(isJoker(a, wildRank)) - Number(isJoker(b, wildRank)) || a.suit.localeCompare(b.suit));
  const tryOrder = (aceHigh: boolean, naturals: Card[], jokers: Card[]): Card[] | null => {
    const r = (c: Card) => (aceHigh && c.rank === 1 ? 14 : c.rank);
    const nat = [...naturals].sort((a, b) => r(a) - r(b));
    if (new Set(nat.map(r)).size !== nat.length) return null;
    const out: Card[] = [];
    const spare = [...jokers];
    for (let i = 0; i < nat.length; i++) {
      if (i) for (let gap = r(nat[i]) - r(nat[i - 1]) - 1; gap > 0; gap--) {
        const j = spare.shift();
        if (!j) return null;
        out.push(j);
      }
      out.push(nat[i]);
    }
    const top = nat.length ? r(nat[nat.length - 1]) : 0;
    const roomAbove = (aceHigh ? 14 : 13) - top;
    out.push(...spare.splice(0, roomAbove));
    out.unshift(...spare);
    return out;
  };
  // Pure runs use every card naturally; otherwise jokers fill the gaps.
  const asPure = cards.every((c) => c.suit !== "X");
  for (const aceHigh of [false, true]) {
    if (kind === "pure" && asPure) {
      const o = tryOrder(aceHigh, cards, []);
      if (o) return o;
    }
    const o = tryOrder(
      aceHigh,
      cards.filter((c) => !isJoker(c, wildRank)),
      cards.filter((c) => isJoker(c, wildRank)),
    );
    if (o) return o;
  }
  return cards;
}

/** Heuristic hand quality for bots: lower is better. */
export function botHandScore(cards: Card[], wildRank: number): number {
  const cost = cards.map((c, i) => {
    const v = cardPoints(c, wildRank);
    if (v === 0) return 0;
    const linked = cards.some(
      (o, j) =>
        j !== i &&
        !isJoker(o, wildRank) &&
        ((o.suit === c.suit && Math.abs(o.rank - c.rank) <= 2 && o.rank !== c.rank) ||
          (o.rank === c.rank && o.suit !== c.suit)),
    );
    return linked ? v * 0.55 : v + 2;
  });
  const sol = solve(cards.length, enumerateMelds(cards, wildRank), cost, (p, s) =>
    p ? (s >= 2 ? 0 : 10) : s >= 1 ? 22 : 30,
  );
  return sol.cost;
}
