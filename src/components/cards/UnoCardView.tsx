"use client";

import clsx from "clsx";
import { CSSProperties, memo } from "react";
import type { UnoCard, UnoColor } from "@/games/uno/engine";
import { CARD_WIDTH, CardSize } from "./PlayingCard";

export const UNO_HEX: Record<UnoColor | "W", string> = {
  R: "#e5303a",
  Y: "#f4b400",
  G: "#22a447",
  B: "#1f6fd8",
  W: "#17171f",
};

const WHEEL = `conic-gradient(from 0deg, ${UNO_HEX.R} 0 25%, ${UNO_HEX.B} 0 50%, ${UNO_HEX.G} 0 75%, ${UNO_HEX.Y} 0 100%)`;

function Symbol({ card, big }: { card: UnoCard; big: boolean }) {
  const v = card.value;
  if (v === "skip")
    return (
      <svg viewBox="0 0 24 24" className="h-[1em] w-[1em]" fill="none" stroke="currentColor" strokeWidth={big ? 3.2 : 3.6}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M6 18 18 6" />
      </svg>
    );
  if (v === "reverse")
    return (
      <svg viewBox="0 0 24 24" className="h-[1em] w-[1em]" fill="none" stroke="currentColor" strokeWidth={big ? 2.8 : 3.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 9h11l-3-3M19 15H8l3 3" />
      </svg>
    );
  if (v === "draw2") return <span>+2</span>;
  if (v === "wild4") return <span>+4</span>;
  if (v === "wild") return <span className="text-[0.8em]">W</span>;
  return <span className={v === "6" || v === "9" ? "underline decoration-[0.06em] underline-offset-[0.08em]" : ""}>{v}</span>;
}

interface Props {
  card?: UnoCard | null;
  size?: CardSize;
  faceDown?: boolean;
  dimmed?: boolean;
  lifted?: boolean;
  highlight?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const UnoBack = memo(function UnoBack({ size = "md", className, style }: { size?: CardSize; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={clsx("relative shrink-0 rounded-[calc(var(--w)*0.1)] bg-white p-[6%] shadow-card", className)}
      style={{ ["--w" as string]: CARD_WIDTH[size], width: "var(--w)", height: "calc(var(--w) * 1.5)", ...style }}
    >
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[calc(var(--w)*0.07)] bg-[#17171f]">
        <div className="absolute h-[62%] w-[120%] -rotate-[28deg] rounded-[50%] bg-[#e5303a]" />
        <span
          className="relative -rotate-[18deg] font-display font-extrabold italic text-gold-400"
          style={{ fontSize: "calc(var(--w) * 0.3)", textShadow: "0 2px 0 #17171f, 0 0 2px #17171f" }}
        >
          UNO
        </span>
      </div>
    </div>
  );
});

export const UnoCardView = memo(function UnoCardView({ card, size = "md", faceDown, dimmed, lifted, highlight, className, style }: Props) {
  if (!card || faceDown) return <UnoBack size={size} className={className} style={style} />;
  const wild = card.color === "W";
  const hex = UNO_HEX[card.color];
  const small = size === "xs" || size === "sm";
  return (
    <div
      className={clsx(
        "relative shrink-0 select-none rounded-[calc(var(--w)*0.1)] bg-white p-[6%] shadow-card transition-[transform,filter,box-shadow] duration-200",
        lifted && "-translate-y-[12%]",
        highlight && "shadow-glow",
        dimmed && "brightness-[.5] saturate-[.6]",
        className,
      )}
      style={{ ["--w" as string]: CARD_WIDTH[size], width: "var(--w)", height: "calc(var(--w) * 1.5)", ...style }}
    >
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[calc(var(--w)*0.07)]"
        style={{ background: `radial-gradient(circle at 30% 20%, ${hex}ee, ${hex} 60%)`, backgroundColor: hex }}
      >
        <div
          className="absolute h-[70%] w-[118%] -rotate-[28deg] rounded-[50%]"
          style={{ background: wild ? WHEEL : "#fff", boxShadow: wild ? "0 0 0 calc(var(--w)*0.03) #fff" : undefined }}
        />
        {!(wild && card.value === "wild") && (
          <span
            className="relative font-display font-extrabold italic leading-none"
            style={{
              fontSize: small ? "calc(var(--w) * 0.5)" : "calc(var(--w) * 0.56)",
              color: wild ? "#fff" : hex,
              textShadow: wild ? "0 0 3px #000, 0 2px 0 #000" : "0 2px 0 rgba(0,0,0,.25)",
              WebkitTextStroke: wild ? undefined : "calc(var(--w)*0.008) rgba(0,0,0,.35)",
            }}
          >
            <Symbol card={card} big />
          </span>
        )}
        {!small && (
          <>
            <span className="absolute left-[8%] top-[4%] font-display font-extrabold italic text-white" style={{ fontSize: "calc(var(--w) * 0.2)", textShadow: "0 1px 1px rgba(0,0,0,.4)" }}>
              <Symbol card={card} big={false} />
            </span>
            <span className="absolute bottom-[4%] right-[8%] rotate-180 font-display font-extrabold italic text-white" style={{ fontSize: "calc(var(--w) * 0.2)", textShadow: "0 1px 1px rgba(0,0,0,.4)" }}>
              <Symbol card={card} big={false} />
            </span>
          </>
        )}
      </div>
    </div>
  );
});
