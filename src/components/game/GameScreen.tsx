"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronLeft, Copy, MessageCircle, ScrollText, Smile, Volume2, VolumeX, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PokerView } from "@/games/poker/engine";
import { GAME_META } from "@/games/registry";
import type { RummyView } from "@/games/rummy/engine";
import type { UnoView } from "@/games/uno/engine";
import { onSoundChange, play, setSoundEnabled, soundEnabled } from "@/lib/client/sound";
import { RoomConn } from "@/lib/client/useRoom";
import { REACTIONS } from "@/lib/room";
import { Modal } from "../ui/Modal";
import { toast } from "../ui/Toaster";
import { RulesContent } from "../Rules";
import { ChatDrawer } from "./ChatDrawer";
import { Confetti } from "./Confetti";
import { GameOver, Standing } from "./GameOver";
import { PokerTable } from "./PokerTable";
import { RummyTable } from "./RummyTable";
import { TableCtx } from "./types";
import { UnoTable } from "./UnoTable";

type AnyView = PokerView | RummyView | UnoView;

const RUMMY_MODE: Record<string, string> = { points: "Points", deals: "Deals", pool101: "Pool 101", pool201: "Pool 201" };

function gameInfo(v: AnyView): string {
  if (v.game === "poker") return `Hand #${v.handNo} · Blinds ${v.sb.toLocaleString()}/${v.bb.toLocaleString()}`;
  if (v.game === "rummy") return `${RUMMY_MODE[v.mode]} · Deal ${v.dealNo}${v.totalDeals && v.totalDeals > 1 ? ` of ${v.totalDeals}` : ""}`;
  return `Round ${v.roundNo} · ${v.target ? `First to ${v.target}` : "Single round"}${v.stacking ? " · Stacking" : ""}`;
}

function actorOf(v: AnyView): string | null {
  return v.game === "poker" ? v.toActId : v.turnId;
}

function standingsOf(v: AnyView, bots: Set<string>): Standing[] | null {
  if (v.game === "poker") return v.standings?.map((s) => ({ id: s.id, name: s.name, bot: bots.has(s.id), value: `${s.chips.toLocaleString()} chips` })) ?? null;
  if (v.game === "rummy") return v.standings?.map((s) => ({ id: s.id, name: s.name, bot: bots.has(s.id), value: `${s.total} pts` })) ?? null;
  return (
    v.standings?.map((s, i) => ({
      id: s.id,
      name: s.name,
      bot: bots.has(s.id),
      value: v.target ? `${s.score} pts` : i === 0 ? `+${s.score} pts` : `${s.cardsLeft} card${s.cardsLeft === 1 ? "" : "s"} left`,
    })) ?? null
  );
}

export function GameScreen({ conn, onExit }: { conn: RoomConn; onExit: (clear: boolean) => void }) {
  const room = conn.room!;
  const g = room.game!;
  const view = g.view as AnyView;
  const meId = room.meId;
  const local = conn.mode === "local";
  const meta = GAME_META[g.gameId];
  const bots = useMemo(() => new Set(g.bots), [g.bots]);

  const [chatOpen, setChatOpen] = useState<false | "chat" | "log">(false);
  const [rules, setRules] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [showOver, setShowOver] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setSound(soundEnabled());
    return onSoundChange(setSound) as () => void;
  }, []);

  const send = conn.send;
  const act = useCallback((action: unknown) => send({ type: "game", action }), [send]);

  // Reactions: latest per player.
  const reactions = useMemo(() => {
    const out: Record<string, { id: string; emoji: string }> = {};
    for (const r of room.reactions) out[r.playerId] = { id: r.id, emoji: r.emoji };
    return out;
  }, [room.reactions]);

  // Notices & chat toasts.
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);
  useEffect(() => {
    for (const n of room.notices) {
      if (!seen.current.has(n.id)) {
        seen.current.add(n.id);
        if (!first.current) toast(n.text);
      }
    }
    for (const m of room.chat) {
      if (!seen.current.has(m.id)) {
        seen.current.add(m.id);
        if (!first.current && m.playerId !== meId && !chatOpen) {
          setUnread((u) => u + 1);
          toast(`${m.name}: ${m.text}`);
          play("click");
        }
      }
    }
    first.current = false;
  }, [room.notices, room.chat, meId, chatOpen]);
  useEffect(() => {
    if (chatOpen === "chat") setUnread(0);
  }, [chatOpen]);

  // Tab title nudge when it's your turn in a background tab.
  const myTurn = !!meId && actorOf(view) === meId;
  useEffect(() => {
    const base = `${meta.name} · Card Club`;
    document.title = myTurn ? `● Your turn — ${base}` : base;
    return () => {
      document.title = "Card Club";
    };
  }, [myTurn, meta.name]);

  // Game over: give everyone a moment to see the final hand first.
  useEffect(() => {
    if (!g.over) {
      setShowOver(false);
      return;
    }
    const t = setTimeout(() => setShowOver(true), g.gameId === "poker" ? 3500 : 6000);
    return () => clearTimeout(t);
  }, [g.over, g.gameId]);
  const standings = standingsOf(view, bots);
  const iWon = g.over && standings?.[0]?.id === meId;
  useEffect(() => {
    if (showOver && iWon) play("win");
  }, [showOver, iWon]);

  const ctx: TableCtx<AnyView> = {
    view,
    meId,
    act,
    offset: conn.offset,
    deadline: g.deadline,
    turnStartedAt: g.turnStartedAt,
    advanceAt: g.advanceAt,
    online: room.online,
    reactions,
    local,
    busy: conn.busy,
    over: g.over,
  };

  const host = room.players.find((p) => p.id === room.hostId);
  const isHost = room.hostId === meId;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/room/${room.code}`);
      toast("Invite link copied", "success");
    } catch {
      toast(`Room code: ${room.code}`);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ paddingTop: "var(--safe-top)" }}>
      <header className="relative z-40 flex items-center gap-1 border-b border-white/[0.05] bg-ink-950/70 px-1.5 py-1.5 backdrop-blur-xl sm:px-3">
        <button className="icon-btn" onClick={() => (local && !g.over ? onExit(false) : setLeaving(true))} aria-label="Leave">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-[15px] font-semibold">{meta.name}</span>
            {!local && (
              <button onClick={copyCode} className="chip bg-white/[0.07] font-mono tracking-widest text-ink-300 transition hover:bg-white/[0.12]" title="Copy invite link">
                {room.code}
                <Copy className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="truncate text-[11px] text-ink-400">{gameInfo(view)}</div>
        </div>
        {!local && (
          <div className="relative">
            <button className="icon-btn" onClick={() => setEmojiOpen((o) => !o)} aria-label="React">
              <Smile className="h-5 w-5" />
            </button>
            <AnimatePresence>
              {emojiOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setEmojiOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.95 }}
                    className="absolute right-0 top-12 z-50 grid w-[208px] grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-ink-850 p-2 shadow-lift"
                  >
                    {REACTIONS.map((e) => (
                      <button
                        key={e}
                        className="rounded-xl py-2 text-2xl transition hover:bg-white/10 active:scale-90"
                        onClick={() => {
                          setEmojiOpen(false);
                          void send({ type: "react", emoji: e });
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
        {!local && (
          <button className="icon-btn relative" onClick={() => setChatOpen("chat")} aria-label="Chat">
            <MessageCircle className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
          </button>
        )}
        <button className="icon-btn" onClick={() => setChatOpen("log")} aria-label="Game log">
          <ScrollText className="h-5 w-5" />
        </button>
        <button className="icon-btn" onClick={() => setRules(true)} aria-label="Rules">
          <BookOpen className="h-5 w-5" />
        </button>
        <button className="icon-btn" onClick={() => setSoundEnabled(!sound)} aria-label={sound ? "Mute" : "Unmute"}>
          {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
      </header>

      <AnimatePresence>
        {conn.reconnecting && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-amber-500/15 text-amber-100">
            <div className="flex items-center justify-center gap-2 py-1.5 text-xs font-medium">
              <WifiOff className="h-3.5 w-3.5" /> Connection lost — reconnecting…
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={clsx("relative min-h-0 flex-1")}>
        {view.game === "poker" && <PokerTable {...(ctx as TableCtx<PokerView>)} />}
        {view.game === "rummy" && <RummyTable {...(ctx as TableCtx<RummyView>)} />}
        {view.game === "uno" && <UnoTable {...(ctx as TableCtx<UnoView>)} />}
      </div>

      <ChatDrawer
        open={!!chatOpen}
        initialTab={chatOpen || "chat"}
        onClose={() => setChatOpen(false)}
        chat={room.chat}
        log={view.log}
        meId={meId}
        showChat={!local}
        onSend={(text) => void send({ type: "chat", text })}
        onReact={(emoji) => void send({ type: "react", emoji })}
      />

      <Modal open={rules} onClose={() => setRules(false)} title={`How to play ${meta.name}`}>
        <RulesContent game={g.gameId} />
      </Modal>

      <Modal open={leaving} onClose={() => setLeaving(false)} title={g.over ? "Leave the table?" : "Leave the game?"}>
        <div className="space-y-4 p-5 text-sm text-ink-200">
          <p>{local ? "This game will end." : g.over ? "You can join another room any time." : "A computer player will take over your seat so the game can continue."}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary h-11" onClick={() => setLeaving(false)}>
              Stay
            </button>
            <button className="btn-danger h-11" onClick={() => onExit(true)}>
              Leave
            </button>
          </div>
        </div>
      </Modal>

      {g.over && showOver && standings && (
        <GameOver
          standings={standings}
          meId={meId}
          local={local}
          canRematch={local || isHost}
          hostName={host?.name ?? "the host"}
          onRematch={() => void send({ type: "rematch" })}
          onLeave={() => onExit(true)}
          onHide={() => setShowOver(false)}
        />
      )}
      {g.over && !showOver && (
        <button onClick={() => setShowOver(true)} className="btn-primary fixed bottom-24 left-1/2 z-40 -translate-x-1/2 shadow-glow">
          Final standings
        </button>
      )}
      <Confetti run={!!(showOver && iWon)} />
    </div>
  );
}
