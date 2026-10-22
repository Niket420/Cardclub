import clsx from "clsx";
import { buildDeck } from "@/games/cards";
import { GameId } from "@/games/types";
import { PlayingCard } from "../cards/PlayingCard";
import { UnoCardView } from "../cards/UnoCardView";

const deck = buildDeck(1, 1);
const c = (id: string) => deck.find((x) => x.id === id)!;

export function Chip({ color = "#d0263e", size = 26, className }: { color?: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={clsx("drop-shadow", className)} aria-hidden>
      <circle cx="20" cy="20" r="19" fill={color} />
      <circle cx="20" cy="20" r="19" fill="none" stroke="#fff" strokeWidth="5" strokeDasharray="6.5 8.4" />
      <circle cx="20" cy="20" r="12.5" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.2" />
      <circle cx="20" cy="20" r="11" fill={color} />
      <circle cx="20" cy="20" r="11" fill="url(#chipshine)" opacity=".35" />
      <defs>
        <radialGradient id="chipshine" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function GameArt({ game, size = "md" }: { game: GameId; size?: "md" | "lg" }) {
  const cs = size === "lg" ? "lg" : "md";
  if (game === "poker")
    return (
      <div className="relative flex items-end">
        <PlayingCard card={c("AS")} size={cs} className="-rotate-[10deg]" />
        <PlayingCard card={c("KH")} size={cs} className="translate-y-[-6%] rotate-[8deg]" style={{ marginLeft: "calc(var(--w) * -0.45)" }} />
        <div className="absolute -bottom-2 -right-7 flex flex-col-reverse">
          {["#d0263e", "#1f6fd8", "#16a34a"].map((col, i) => (
            <Chip key={col} color={col} size={size === "lg" ? 30 : 24} className={i ? "-mb-[70%]" : ""} />
          ))}
        </div>
      </div>
    );
  if (game === "rummy")
    return (
      <div className="flex items-end">
        {["7H", "8H", "9H"].map((id, i) => (
          <PlayingCard key={id} card={c(id)} size={cs} style={{ marginLeft: i ? "calc(var(--w) * -0.55)" : 0, transform: `rotate(${(i - 1.5) * 9}deg) translateY(${Math.abs(i - 1.5) * 5}%)` }} />
        ))}
        <PlayingCard card={c("JK-0")} size={cs} style={{ marginLeft: "calc(var(--w) * -0.55)", transform: "rotate(14deg) translateY(8%)" }} />
      </div>
    );
  return (
    <div className="flex items-end">
      {(
        [
          { id: "a", color: "R", value: "7" },
          { id: "b", color: "B", value: "reverse" },
          { id: "c", color: "W", value: "wild4" },
        ] as const
      ).map((card, i) => (
        <UnoCardView key={card.id} card={card} size={cs} style={{ marginLeft: i ? "calc(var(--w) * -0.5)" : 0, transform: `rotate(${(i - 1) * 12}deg) translateY(${Math.abs(i - 1) * 6}%)` }} />
      ))}
    </div>
  );
}
