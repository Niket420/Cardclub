import { Card, rankName } from "../cards";

export interface HandValue {
  /** Comparable score: higher wins. */
  score: number;
  category: number;
  name: string;
  /** Ids of the five cards making the hand. */
  cards: string[];
}

export const CATEGORY_NAMES = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
];

const hi = (r: number) => (r === 1 ? 14 : r);

function score5(cards: Card[]): { score: number; category: number; ranks: number[] } {
  const ranks = cards.map((c) => hi(c.rank)).sort((a, b) => b - a);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const uniq = [...new Set(ranks)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5) straightHigh = 5; // wheel A-2-3-4-5
  }
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const order = groups.map((g) => g[0]);
  const shape = groups.map((g) => g[1]).join("");

  let category: number;
  let tiebreak: number[];
  if (straightHigh && flush) [category, tiebreak] = [8, [straightHigh]];
  else if (shape === "41") [category, tiebreak] = [7, order];
  else if (shape === "32") [category, tiebreak] = [6, order];
  else if (flush) [category, tiebreak] = [5, ranks];
  else if (straightHigh) [category, tiebreak] = [4, [straightHigh]];
  else if (shape === "311") [category, tiebreak] = [3, order];
  else if (shape === "221") [category, tiebreak] = [2, order];
  else if (shape === "2111") [category, tiebreak] = [1, order];
  else [category, tiebreak] = [0, ranks];

  let score = category;
  for (let i = 0; i < 5; i++) score = score * 16 + (tiebreak[i] ?? 0);
  return { score, category, ranks: tiebreak };
}

function describe(category: number, t: number[]): string {
  switch (category) {
    case 8:
      return t[0] === 14 ? "Royal Flush" : `Straight Flush, ${rankName(t[0])} high`;
    case 7:
      return `Four of a Kind, ${rankName(t[0], true)}`;
    case 6:
      return `Full House, ${rankName(t[0], true)} over ${rankName(t[1], true)}`;
    case 5:
      return `Flush, ${rankName(t[0])} high`;
    case 4:
      return `Straight, ${rankName(t[0])} high`;
    case 3:
      return `Three of a Kind, ${rankName(t[0], true)}`;
    case 2:
      return `Two Pair, ${rankName(t[0], true)} and ${rankName(t[1], true)}`;
    case 1:
      return `Pair of ${rankName(t[0], true)}`;
    default:
      return `High Card, ${rankName(t[0])}`;
  }
}

/** Best five-card hand out of 5–7 cards. */
export function evaluate(cards: Card[]): HandValue {
  const n = cards.length;
  let best: { score: number; category: number; ranks: number[]; idx: number[] } | null = null;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const r = score5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || r.score > best.score) best = { ...r, idx: [a, b, c, d, e] };
          }
  if (!best) throw new Error("evaluate needs at least 5 cards");
  return {
    score: best.score,
    category: best.category,
    name: describe(best.category, best.ranks),
    cards: best.idx.map((i) => cards[i].id),
  };
}

/** Fast score-only evaluation for simulations. */
export function quickScore(cards: Card[]): number {
  const n = cards.length;
  let best = -1;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const s = score5([cards[a], cards[b], cards[c], cards[d], cards[e]]).score;
            if (s > best) best = s;
          }
  return best;
}
