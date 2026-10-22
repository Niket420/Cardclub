import { GameId } from "@/games/types";

interface Section {
  title: string;
  points: string[];
}

const RULES: Record<GameId, { intro: string; sections: Section[] }> = {
  poker: {
    intro: "No-limit Texas Hold'em. Make the best five-card hand from your two hole cards and five shared community cards — or make everyone else fold.",
    sections: [
      {
        title: "A hand, step by step",
        points: [
          "The two players left of the dealer button post the small and big blinds. Everyone gets two private cards.",
          "Pre-flop betting starts left of the big blind. Then the flop (3 cards), turn (1) and river (1) are dealt, with a betting round after each.",
          "On your turn: Fold, Check (if nothing to call), Call, Bet or Raise. A raise must be at least the size of the previous bet or raise. You can go all-in any time.",
          "If everyone else folds, you win the pot without showing. Otherwise, the best hand at showdown wins. Ties split the pot.",
        ],
      },
      {
        title: "Hand rankings (best to worst)",
        points: [
          "Royal Flush — A K Q J 10 of one suit",
          "Straight Flush — five in a row, same suit",
          "Four of a Kind",
          "Full House — three of a kind plus a pair",
          "Flush — five of the same suit",
          "Straight — five in a row (A-2-3-4-5 counts)",
          "Three of a Kind",
          "Two Pair",
          "Pair",
          "High Card",
        ],
      },
      {
        title: "All-ins & side pots",
        points: [
          "You can never lose more than you put in. If you're all-in for less, you can only win the part of the pot you matched; the rest forms a side pot.",
          "When everyone left is all-in, the cards are turned face up and the board is dealt out.",
          "Run out of chips and you're out. Last player with chips wins. Blinds may double over time to keep things moving.",
        ],
      },
    ],
  },
  rummy: {
    intro: "13-card Indian Rummy. Arrange all your cards into valid groups and declare before anyone else.",
    sections: [
      {
        title: "Goal",
        points: [
          "Form at least two sequences, one of which must be a pure sequence. All remaining cards must be in valid sequences or sets.",
          "Pure sequence: 3+ consecutive cards of one suit with no joker (e.g. 4♥ 5♥ 6♥).",
          "Impure sequence: consecutive cards of one suit using a joker (e.g. 4♥ JOKER 6♥).",
          "Set: 3 or 4 cards of the same rank in different suits (e.g. 8♠ 8♦ 8♣). Jokers can complete sets.",
          "Ace can be low (A-2-3) or high (Q-K-A) but not wrap around (K-A-2).",
        ],
      },
      {
        title: "Jokers",
        points: [
          "A card is cut at the start of each deal — every card of that rank is a wild joker for the deal (marked with a purple J). Printed jokers are wild too.",
          "A wild card can still be used as itself in a pure sequence.",
          "A joker discarded by another player can't be picked up.",
        ],
      },
      {
        title: "Your turn",
        points: [
          "Draw one card from the closed deck or the open pile, then discard one card. You can't throw back the card you just picked from the open pile.",
          "To finish, select your last card and tap Declare. If your 13 cards are valid you win the deal; an invalid declaration costs 80 points.",
          "Arrange cards: tap to select, then Group them or move them onto another group. On a computer you can also drag cards.",
        ],
      },
      {
        title: "Scoring",
        points: [
          "The winner scores 0. Others score the value of cards not in valid groups: A, K, Q, J = 10, number cards = face value, jokers = 0. Maximum 80.",
          "Without a pure sequence, every card counts. With a pure sequence but no second sequence, everything except pure sequences counts.",
          "Drop at the start of your turn to cut losses: 20 points before your first draw, 40 after (25/50 in Pool 201).",
          "Points: one deal. Deals: lowest total after 3 deals wins. Pool 101/201: reach the limit and you're out — last player standing wins.",
        ],
      },
    ],
  },
  uno: {
    intro: "Be the first to get rid of all your cards. Match the top card by color, number or symbol.",
    sections: [
      {
        title: "Your turn",
        points: [
          "Play one card that matches the top card's color, number or symbol — or a Wild.",
          "Can't (or don't want to) play? Draw one card. If it's playable you may play it right away, otherwise your turn ends.",
          "Wild: choose the next color. Wild +4: next player draws four and is skipped — you can only play it when you have no card matching the current color.",
        ],
      },
      {
        title: "Action cards",
        points: [
          "Skip — the next player loses their turn.",
          "Reverse — play changes direction (acts as a Skip with two players).",
          "+2 — the next player draws two and loses their turn.",
          "Stacking (house rule, optional): a +2 can be answered with a +2 or +4, and a +4 with a +4. The total passes on until someone draws it.",
        ],
      },
      {
        title: "UNO!",
        points: [
          "When you play your second-to-last card, hit the UNO button.",
          "If you forget and another player catches you before the next player moves, you draw two cards.",
        ],
      },
      {
        title: "Scoring",
        points: [
          "The round winner scores the cards left in everyone else's hands: number cards at face value, Skip / Reverse / +2 = 20, Wild and Wild +4 = 50.",
          "Play a single round, or play several rounds until someone reaches the target score.",
        ],
      },
    ],
  },
};

export function RulesContent({ game }: { game: GameId }) {
  const r = RULES[game];
  return (
    <div className="space-y-6 px-5 py-5 text-sm leading-relaxed text-ink-200">
      <p className="text-[15px] text-ink-100">{r.intro}</p>
      {r.sections.map((s) => (
        <section key={s.title}>
          <h3 className="mb-2 font-display text-[15px] font-semibold text-gold-400">{s.title}</h3>
          <ul className="space-y-1.5">
            {s.points.map((p) => (
              <li key={p} className="flex gap-2.5">
                <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-400" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
