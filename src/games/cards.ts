export type Suit = "S" | "H" | "D" | "C";

/** A French-suited card. rank: 1 = Ace … 11 = J, 12 = Q, 13 = K. Jokers use rank 0, suit "X". */
export interface Card {
  id: string;
  rank: number;
  suit: Suit | "X";
}

export const SUITS: Suit[] = ["S", "H", "D", "C"];

export const SUIT_SYMBOL: Record<Suit | "X", string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
  X: "★",
};

export const SUIT_NAME: Record<Suit, string> = {
  S: "Spades",
  H: "Hearts",
  D: "Diamonds",
  C: "Clubs",
};

export function rankLabel(rank: number): string {
  switch (rank) {
    case 0:
      return "JKR";
    case 1:
    case 14:
      return "A";
    case 11:
      return "J";
    case 12:
      return "Q";
    case 13:
      return "K";
    default:
      return String(rank);
  }
}

export function rankName(rank: number, plural = false): string {
  const names: Record<number, string> = {
    1: "Ace",
    14: "Ace",
    2: "Two",
    3: "Three",
    4: "Four",
    5: "Five",
    6: "Six",
    7: "Seven",
    8: "Eight",
    9: "Nine",
    10: "Ten",
    11: "Jack",
    12: "Queen",
    13: "King",
  };
  const n = names[rank] ?? "Joker";
  if (!plural) return n;
  return n === "Six" ? "Sixes" : n + "s";
}

export function cardLabel(c: Card): string {
  if (c.suit === "X") return "Joker";
  return rankLabel(c.rank) + SUIT_SYMBOL[c.suit];
}

export function isRed(suit: Suit | "X"): boolean {
  return suit === "H" || suit === "D";
}

/** Builds `decks` standard 52-card decks plus `jokers` printed jokers. */
export function buildDeck(decks = 1, jokers = 0): Card[] {
  const out: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) {
      for (let r = 1; r <= 13; r++) {
        out.push({ id: `${rankLabel(r)}${s}${d ? "-" + d : ""}`, rank: r, suit: s });
      }
    }
  }
  for (let j = 0; j < jokers; j++) out.push({ id: `JK-${j}`, rank: 0, suit: "X" });
  return out;
}

export function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % maxExclusive;
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pick<T>(arr: T[]): T {
  return arr[randomInt(arr.length)];
}
