"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { useId } from "react";

export interface SegOption<T> {
  value: T;
  label: string;
  hint?: string;
}

export function Segmented<T extends string | number | boolean>({
  options,
  value,
  onChange,
  disabled,
  size = "md",
}: {
  options: SegOption<T>[];
  value: T;
  onChange?: (v: T) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div className={clsx("relative grid gap-1 rounded-xl border border-white/[0.07] bg-ink-900/80 p-1", disabled && "opacity-70")} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(o.value)}
            className={clsx(
              "relative z-0 flex flex-col items-center justify-center rounded-lg px-2 text-center transition-colors",
              size === "sm" ? "py-1.5" : "py-2",
              active ? "text-ink-950" : "text-ink-300 hover:text-ink-100",
              disabled && "cursor-default",
            )}
          >
            {active && <motion.div layoutId={id} className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-b from-gold-300 to-gold-500 shadow" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="text-[13px] font-semibold leading-tight">{o.label}</span>
            {o.hint && <span className={clsx("mt-0.5 text-[10px] leading-tight", active ? "text-ink-900/70" : "text-ink-400")}>{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
