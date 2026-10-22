"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatMessage, REACTIONS } from "@/lib/room";

interface Props {
  open: boolean;
  onClose: () => void;
  chat: ChatMessage[];
  log: string[];
  meId: string | null;
  showChat: boolean;
  onSend: (text: string) => void;
  onReact: (emoji: string) => void;
  initialTab?: "chat" | "log";
}

export function ChatDrawer({ open, onClose, chat, log, meId, showChat, onSend, onReact, initialTab = "chat" }: Props) {
  const [tab, setTab] = useState<"chat" | "log">(showChat ? initialTab : "log");
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTab(showChat ? initialTab : "log");
  }, [open, initialTab, showChat]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length, log.length, tab, open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-sm flex-col border-l border-white/10 bg-ink-850/95 shadow-lift backdrop-blur-xl"
            style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
          >
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-3">
              {showChat && (
                <div className="flex rounded-xl bg-ink-900 p-1">
                  {(["chat", "log"] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)} className={clsx("rounded-lg px-3 py-1.5 text-sm font-semibold transition", tab === t ? "bg-white/10 text-ink-100" : "text-ink-400 hover:text-ink-200")}>
                      {t === "chat" ? "Chat" : "Game log"}
                    </button>
                  ))}
                </div>
              )}
              {!showChat && <div className="px-2 font-display font-semibold">Game log</div>}
              <button className="icon-btn ml-auto h-9 w-9" onClick={onClose} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div ref={listRef} className="thin-scrollbar flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {tab === "chat" ? (
                chat.length ? (
                  chat.map((m) => {
                    const mine = m.playerId === meId;
                    return (
                      <div key={m.id} className={clsx("flex flex-col", mine ? "items-end" : "items-start")}>
                        {!mine && <span className="mb-0.5 px-1 text-[11px] font-semibold text-ink-400">{m.name}</span>}
                        <span className={clsx("max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm", mine ? "rounded-br-md bg-gold-400 text-ink-950" : "rounded-bl-md bg-white/[0.08] text-ink-100")}>
                          {m.text}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="pt-10 text-center text-sm text-ink-400">No messages yet. Say hi 👋</p>
                )
              ) : log.length ? (
                log.map((l, i) => (
                  <div key={i} className={clsx("rounded-lg px-3 py-1.5 text-[13px]", i === log.length - 1 ? "bg-white/[0.06] text-ink-100" : "text-ink-300")}>
                    {l}
                  </div>
                ))
              ) : (
                <p className="pt-10 text-center text-sm text-ink-400">Nothing yet.</p>
              )}
            </div>

            {tab === "chat" && showChat && (
              <div className="border-t border-white/[0.06] p-3">
                <div className="no-scrollbar mb-2 flex gap-1 overflow-x-auto">
                  {REACTIONS.map((e) => (
                    <button key={e} className="shrink-0 rounded-lg px-2 py-1 text-xl transition hover:bg-white/10 active:scale-90" onClick={() => onReact(e)} aria-label={`React ${e}`}>
                      {e}
                    </button>
                  ))}
                </div>
                <form onSubmit={submit} className="flex gap-2">
                  <input className="input py-2.5" placeholder="Message the table…" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
                  <button className="btn-primary px-3.5" aria-label="Send" disabled={!text.trim()}>
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
