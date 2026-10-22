"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useEffect, useState } from "react";

type Kind = "error" | "success" | "info";
interface Toast {
  id: number;
  text: string;
  kind: Kind;
}

let seq = 0;
const subs = new Set<(t: Toast) => void>();

export function toast(text: string, kind: Kind = "info") {
  const t = { id: ++seq, text, kind };
  subs.forEach((fn) => fn(t));
}

const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info };
const TONE = {
  error: "border-rose-400/25 text-rose-100",
  success: "border-emerald-400/25 text-emerald-100",
  info: "border-white/10 text-ink-100",
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const fn = (t: Toast) => {
      setItems((xs) => [...xs.filter((x) => x.text !== t.text), t].slice(-3));
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), t.kind === "error" ? 3800 : 2800);
    };
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4" style={{ paddingTop: "var(--safe-top)" }} aria-live="polite">
      <AnimatePresence>
        {items.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              className={`pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border bg-ink-850/95 px-4 py-2.5 text-sm font-medium shadow-lift backdrop-blur-xl ${TONE[t.kind]}`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {t.text}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
