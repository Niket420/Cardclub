"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Crown, Eye, Home, RotateCcw } from "lucide-react";
import { Avatar } from "../ui/Avatar";

export interface Standing {
  id: string;
  name: string;
  value: string;
  bot: boolean;
}

interface Props {
  standings: Standing[];
  meId: string | null;
  canRematch: boolean;
  hostName: string;
  onRematch: () => void;
  onLeave: () => void;
  onHide: () => void;
  local: boolean;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function GameOver({ standings, meId, canRematch, hostName, onRematch, onLeave, onHide, local }: Props) {
  const winner = standings[0];
  const iWon = winner?.id === meId;
  return (
    <motion.div className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        initial={{ y: 40, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.15 }}
        className="relative w-full overflow-hidden rounded-t-3xl border border-white/10 bg-ink-850 shadow-lift sm:max-w-md sm:rounded-3xl"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <div className="relative overflow-hidden px-6 pb-6 pt-8 text-center">
          <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", delay: 0.35 }} className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-600 shadow-glow">
            <Crown className="h-8 w-8 text-ink-950" />
          </motion.div>
          <h2 className="relative font-display text-3xl font-extrabold">{iWon ? "You win!" : `${winner?.name ?? "Someone"} wins`}</h2>
          <p className="relative mt-1 text-sm text-ink-300">{iWon ? "Brilliant game. Take a bow." : "Good game! Ready for another?"}</p>
        </div>
        <ol className="thin-scrollbar max-h-[40dvh] space-y-1.5 overflow-y-auto px-4">
          {standings.map((s, i) => (
            <li key={s.id} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5", i === 0 ? "bg-gold-400/10 ring-1 ring-gold-400/30" : "bg-white/[0.04]")}>
              <span className="w-6 text-center text-lg">{MEDALS[i] ?? <span className="text-sm font-semibold text-ink-400">{i + 1}</span>}</span>
              <Avatar id={s.id} name={s.name} bot={s.bot} size={32} />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {s.name}
                {s.id === meId && <span className="ml-2 text-xs font-medium text-gold-400">You</span>}
              </span>
              <span className="text-sm font-semibold text-ink-200 tabular">{s.value}</span>
            </li>
          ))}
        </ol>
        <div className="space-y-2 p-4">
          {canRematch ? (
            <button className="btn-primary h-12 w-full text-base" onClick={onRematch}>
              <RotateCcw className="h-4 w-4" /> {local ? "Play again" : "New game"}
            </button>
          ) : (
            <div className="rounded-xl bg-white/[0.04] px-4 py-3 text-center text-sm text-ink-300">Waiting for {hostName} to start a new game…</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={onHide}>
              <Eye className="h-4 w-4" /> View table
            </button>
            <button className="btn-secondary" onClick={onLeave}>
              <Home className="h-4 w-4" /> {local ? "Home" : "Leave"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
