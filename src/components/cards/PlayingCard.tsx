"use client";

import clsx from "clsx";
import { CSSProperties, memo } from "react";
import { Card, isRed, rankLabel, SUIT_SYMBOL } from "@/games/cards";

export type CardSize = "xs" | "sm" | "md" | "lg" | "xl";

export const CARD_WIDTH: Record<CardSize, string> = {
  xs: "26px",
  sm: "clamp(34px, 8.4vw, 50px)",
  md: "clamp(44px, 11.5vw, 66px)",
  lg: "clamp(52px, 14vw, 86px)",
  xl: "clamp(62px, 17vw, 104px)",
};

const RED = "#d0263e";
const BLACK = "#141b2d";

interface Props {
  card?: Card | null;
  size?: CardSize;
  faceDown?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  highlight?: boolean;
  /** Rummy: this card is a wild joker. */
  wild?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const CardBack = memo(function CardBack({ size = "md", className, style }: { size?: CardSize; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={clsx("card-back relative shrink-0 rounded-[calc(var(--w)*0.09)] shadow-card ring-1 ring-black/30", className)}
      style={{ ["--w" as string]: CARD_WIDTH[size], width: "var(--w)", height: "calc(var(--w) * 1.4)", ...style }}
    >
      <div className="absolute inset-[7%] rounded-[calc(var(--w)*0.06)] border border-white/25" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-[30%] w-[30%] rotate-45 items-center justify-center rounded-[18%] border border-gold-400/70 bg-[#1c2a5a]">
          <div className="h-[40%] w-[40%] rounded-full bg-gold-400/80" />
        </div>
      </div>
    </div>
  );
});

function FaceCenter({ card, color }: { card: Card; color: string }) {
  const sym = SUIT_SYMBOL[card.suit];
  if (card.suit === "X") {
    return (
      <div className="flex flex-col items-center justify-center leading-none">
        <span style={{ fontSize: "calc(var(--w) * 0.5)" }} className="bg-gradient-to-br from-fuchsia-500 via-amber-400 to-sky-500 bg-clip-text text-transparent">
          ★
        </span>
      </div>
    );
  }
  if (card.rank >= 11) {
    return (
      <div
        className="flex h-[58%] w-[62%] flex-col items-center justify-center rounded-[calc(var(--w)*0.05)] border"
        style={{ borderColor: color + "40", background: `linear-gradient(160deg, ${color}12, ${color}05)` }}
      >
        <span className="font-serif font-black leading-none" style={{ fontSize: "calc(var(--w) * 0.42)", color }}>
          {rankLabel(card.rank)}
        </span>
        <span className="leading-none" style={{ fontSize: "calc(var(--w) * 0.22)", color }}>
          {sym}
        </span>
      </div>
    );
  }
  return (
    <span className="leading-none" style={{ fontSize: card.rank === 1 ? "calc(var(--w) * 0.62)" : "calc(var(--w) * 0.5)", color }}>
      {sym}
    </span>
  );
}

export const PlayingCard = memo(function PlayingCard({ card, size = "md", faceDown, selected, dimmed, highlight, wild, className, style }: Props) {
  if (!card || faceDown) return <CardBack size={size} className={className} style={style} />;
  const joker = card.suit === "X";
  const color = joker ? "#7c3aed" : isRed(card.suit) ? RED : BLACK;
  const label = joker ? "JKR" : rankLabel(card.rank);
  const small = size === "xs" || size === "sm";
  return (
    <div
      className={clsx(
        "relative shrink-0 select-none overflow-hidden rounded-[calc(var(--w)*0.09)] bg-gradient-to-br from-white to-[#f1f2f6] shadow-card ring-1 ring-black/10 transition-[transform,filter,box-shadow] duration-200",
        selected && "-translate-y-[14%] shadow-glow",
        highlight && "shadow-glow",
        dimmed && "brightness-[.55] saturate-50",
        className,
      )}
      style={{ ["--w" as string]: CARD_WIDTH[size], width: "var(--w)", height: "calc(var(--w) * 1.4)", ...style }}
      aria-label={joker ? "Joker" : `${label} of ${card.suit}`}
    >
      <div className="absolute left-[7%] top-[4%] flex flex-col items-center leading-none" style={{ color }}>
        <span className="font-display font-bold tracking-tight" style={{ fontSize: joker ? "calc(var(--w) * 0.17)" : "calc(var(--w) * 0.28)" }}>
          {label}
        </span>
        <span style={{ fontSize: "calc(var(--w) * 0.22)", marginTop: "calc(var(--w) * 0.01)" }}>{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <div className={clsx("absolute inset-0 flex items-center justify-center", small ? "pt-[34%] pl-[24%]" : "pt-[8%]")}>
        <FaceCenter card={card} color={color} />
      </div>
      {!small && (
        <div className="absolute bottom-[4%] right-[7%] flex rotate-180 flex-col items-center leading-none" style={{ color }}>
          <span className="font-display font-bold tracking-tight" style={{ fontSize: joker ? "calc(var(--w) * 0.17)" : "calc(var(--w) * 0.2)" }}>
            {label}
          </span>
        </div>
      )}
      {wild && !joker && (
        <div
          className="absolute right-[5%] top-[4%] rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 px-[4%] font-bold text-white"
          style={{ fontSize: "calc(var(--w) * 0.14)", lineHeight: 1.35 }}
          title="Wild joker"
        >
          J
        </div>
      )}
    </div>
  );
});
