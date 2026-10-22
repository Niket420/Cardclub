"use client";

import { motion } from "framer-motion";

/** Ring around an avatar: drains over the turn timer, or pulses when there is no timer. */
export function TurnRing({ size, deadline, startedAt, offset }: { size: number; deadline: number | null; startedAt: number; offset: number }) {
  const r = size / 2 + 4;
  const box = r * 2 + 6;
  if (!deadline) {
    return <span className="pointer-events-none absolute inset-[-5px] animate-pulse-ring rounded-full ring-[3px] ring-gold-400" />;
  }
  const total = Math.max(1, deadline - startedAt);
  const left = Math.max(0, deadline - (Date.now() + offset));
  const frac = left / total;
  return (
    <svg className="pointer-events-none absolute" style={{ width: box, height: box, left: -(box - size) / 2, top: -(box - size) / 2 }} viewBox={`0 0 ${box} ${box}`}>
      <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="4" />
      <motion.circle
        key={deadline}
        cx={box / 2}
        cy={box / 2}
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        transform={`rotate(-90 ${box / 2} ${box / 2})`}
        stroke={left < 6000 ? "#f43f5e" : "#f8cf6a"}
        initial={{ pathLength: frac }}
        animate={{ pathLength: 0 }}
        transition={{ duration: left / 1000, ease: "linear" }}
      />
    </svg>
  );
}

/** Thin horizontal timer bar for the local player. */
export function TimerBar({ deadline, startedAt, offset }: { deadline: number | null; startedAt: number; offset: number }) {
  if (!deadline) return null;
  const total = Math.max(1, deadline - startedAt);
  const left = Math.max(0, deadline - (Date.now() + offset));
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
      <motion.div
        key={deadline}
        className="h-full origin-left rounded-full bg-gradient-to-r from-rose-500 via-gold-400 to-gold-300"
        initial={{ scaleX: left / total }}
        animate={{ scaleX: 0 }}
        transition={{ duration: left / 1000, ease: "linear" }}
      />
    </div>
  );
}
