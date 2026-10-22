"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";
import clsx from "clsx";

interface Props {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Bottom sheet on phones, centered dialog on larger screens. */
  className?: string;
}

export function Modal({ open, onClose, title, children, wide, className }: Props) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className={clsx(
              "relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-850 shadow-lift sm:rounded-3xl",
              wide ? "sm:max-w-3xl" : "sm:max-w-lg",
              className,
            )}
            style={{ paddingBottom: "var(--safe-bottom)" }}
          >
            {(title || onClose) && (
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
                <div className="font-display text-lg font-semibold">{title}</div>
                {onClose && (
                  <button className="icon-btn -mr-2 h-9 w-9" onClick={onClose} aria-label="Close">
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
            <div className="thin-scrollbar overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
