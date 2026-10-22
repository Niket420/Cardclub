"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { ReactNode } from "react";
import { useMediaQuery } from "@/lib/client/hooks";
import { Avatar } from "../ui/Avatar";
import { TurnRing } from "./TurnRing";

export interface SeatProps {
  id: string;
  name: string;
  bot: boolean;
  active: boolean;
  deadline: number | null;
  startedAt: number;
  offset: number;
  subtitle?: ReactNode;
  badge?: ReactNode;
  status?: ReactNode;
  dimmed?: boolean;
  offline?: boolean;
  reaction?: { id: string; emoji: string } | null;
  side?: ReactNode;
  winner?: boolean;
  avatarSize?: number;
}

export function Seat({ id, name, bot, active, deadline, startedAt, offset, subtitle, badge, status, dimmed, offline, reaction, side, winner, avatarSize = 44 }: SeatProps) {
  return (
    <div className={clsx("flex w-[84px] flex-col items-center sm:w-[112px]", dimmed && "opacity-50")}>
      <div className="relative flex items-center">
        <div className={clsx("relative rounded-full", winner && "shadow-glow")}>
          {active && <TurnRing size={avatarSize} deadline={deadline} startedAt={startedAt} offset={offset} />}
          <Avatar id={id} name={name} bot={bot} size={avatarSize} />
          {offline && (
            <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink-800 text-rose-300 ring-2 ring-ink-900" title="Disconnected">
              <WifiOff className="h-3 w-3" />
            </span>
          )}
          {badge && <div className="absolute -right-2 -top-1">{badge}</div>}
          <AnimatePresence>
            {reaction && (
              <motion.span
                key={reaction.id}
                initial={{ opacity: 0, y: 0, scale: 0.5 }}
                animate={{ opacity: [0, 1, 1, 0], y: -34, scale: [0.5, 1.25, 1, 1] }}
                transition={{ duration: 2.6, times: [0, 0.15, 0.8, 1] }}
                className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 text-3xl drop-shadow-lg"
              >
                {reaction.emoji}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {side && <div className="absolute left-full top-1/2 ml-1 -translate-y-1/2">{side}</div>}
      </div>
      <div
        className={clsx(
          "mt-1.5 w-full rounded-lg border px-1.5 py-1 text-center backdrop-blur-md transition-colors",
          active ? "border-gold-400/50 bg-black/55" : "border-white/[0.06] bg-black/40",
        )}
      >
        <div className="truncate text-[11px] font-semibold leading-tight text-ink-100 sm:text-xs">{name}</div>
        {subtitle !== undefined && <div className="truncate text-[10px] leading-tight text-ink-300 tabular sm:text-[11px]">{subtitle}</div>}
      </div>
      <div className="mt-1 h-5">{status}</div>
    </div>
  );
}

/** Opponent positions around an ellipse, with the local player at the bottom. Returns % coordinates. */
export function seatPositions(count: number, rx = 42, ry = 38) {
  const out: { x: number; y: number; angle: number }[] = [];
  for (let i = 1; i <= count; i++) {
    const a = ((90 + (i * 360) / (count + 1)) * Math.PI) / 180;
    out.push({ x: 50 + rx * Math.cos(a), y: 50 + ry * Math.sin(a), angle: a });
  }
  return out;
}

/** Seat ellipse sized for the screen: tighter on phones so side seats stay on screen. */
export function useSeatPositions(count: number) {
  const narrow = useMediaQuery("(max-width: 639px)");
  return seatPositions(count, narrow ? 35 : 41, 37);
}

/** Rotates the seat list so `meId` comes first (bottom of the table). */
export function rotateToMe<T extends { id: string }>(players: T[], meId: string | null): T[] {
  const i = players.findIndex((p) => p.id === meId);
  if (i <= 0) return players;
  return [...players.slice(i), ...players.slice(0, i)];
}

export function StatusPill({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "good" | "bad" | "gold" | "info" }) {
  const tones = {
    neutral: "bg-white/10 text-ink-200",
    good: "bg-emerald-500/20 text-emerald-200",
    bad: "bg-rose-500/20 text-rose-200",
    gold: "bg-gold-400/20 text-gold-300",
    info: "bg-sky-500/20 text-sky-200",
  };
  return (
    <motion.span key={text} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={clsx("chip whitespace-nowrap", tones[tone])}>
      {text}
    </motion.span>
  );
}
