"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Check, Copy, Crown, LogOut, MessageCircle, QrCode as QrIcon, Share2, Timer, UserMinus, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GAME_IDS, GAME_META, TURN_TIMER_OPTIONS } from "@/games/registry";
import { GameId } from "@/games/types";
import { play } from "@/lib/client/sound";
import { RoomConn } from "@/lib/client/useRoom";
import { ChatDrawer } from "../game/ChatDrawer";
import { GameArt } from "../home/GameArt";
import { GameSettingsFields, SeatStepper } from "../home/SetupSheet";
import { Avatar } from "../ui/Avatar";
import { Logo } from "../ui/Logo";
import { Modal } from "../ui/Modal";
import { Segmented } from "../ui/Segmented";
import { toast } from "../ui/Toaster";
import { QrCode } from "./QrCode";

export function Lobby({ conn, onLeave }: { conn: RoomConn; onLeave: () => void }) {
  const room = conn.room!;
  const meId = room.meId;
  const isHost = room.hostId === meId;
  const meta = GAME_META[room.settings.gameId];
  const humans = room.players.length;
  const bots = Math.max(0, room.settings.seats - humans);
  const [qr, setQr] = useState(false);
  const [chat, setChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");
  const host = room.players.find((p) => p.id === room.hostId);

  useEffect(() => setLink(`${location.origin}/room/${room.code}`), [room.code]);

  // Chime when someone joins.
  const prevCount = useRef(humans);
  useEffect(() => {
    if (humans > prevCount.current) play("click");
    prevCount.current = humans;
  }, [humans]);

  const update = (s: Record<string, unknown>) => void conn.send({ type: "settings", settings: s });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast(link);
    }
  };
  const share = async () => {
    const text = `Join my ${meta.name} table on Card Club — room code ${room.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Card Club", text, url: link });
      } catch {
        /* cancelled */
      }
    } else void copy();
  };

  return (
    <div className="min-h-[100dvh] pb-32">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <button className="icon-btn" onClick={() => setChat(true)} aria-label="Chat">
            <MessageCircle className="h-5 w-5" />
          </button>
          <button className="btn-ghost px-3" onClick={onLeave}>
            <LogOut className="h-4 w-4" /> Leave
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-5 px-4 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {/* Invite */}
          <section className="panel relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/10 blur-3xl" />
            <div className="label">Room code</div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-1.5">
                {room.code.split("").map((ch, i) => (
                  <motion.span
                    key={i}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex h-14 w-11 items-center justify-center rounded-xl border border-white/10 bg-ink-900 font-display text-3xl font-bold text-gold-300 sm:h-16 sm:w-12"
                  >
                    {ch}
                  </motion.span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={copy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <button className="btn-secondary" onClick={share}>
                  <Share2 className="h-4 w-4" /> Share
                </button>
                <button className="btn-secondary px-3" onClick={() => setQr(true)} aria-label="Show QR code">
                  <QrIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-300">Friends open the link or go to the home page and enter this code. They&apos;ll just need a name.</p>
          </section>

          {/* Seats */}
          <section className="panel p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Users className="h-5 w-5 text-ink-400" /> Players
              </h2>
              <span className="text-sm text-ink-400 tabular">
                {humans} / {room.settings.seats}
              </span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              <AnimatePresence initial={false}>
                {room.players.map((p) => (
                  <motion.li
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
                  >
                    <div className="relative">
                      <Avatar id={p.id} name={p.name} size={38} />
                      <span className={clsx("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-ink-850", p.online ? "bg-emerald-400" : "bg-ink-500")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate font-semibold">
                        {p.name}
                        {p.id === room.hostId && <Crown className="h-3.5 w-3.5 shrink-0 text-gold-400" />}
                      </div>
                      <div className="text-xs text-ink-400">{p.id === meId ? "You" : p.id === room.hostId ? "Host" : p.online ? "Ready" : "Away"}</div>
                    </div>
                    {isHost && p.id !== meId && (
                      <button className="icon-btn h-8 w-8 text-ink-400 hover:text-rose-300" onClick={() => conn.send({ type: "kick", playerId: p.id })} aria-label={`Remove ${p.name}`}>
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </motion.li>
                ))}
                {Array.from({ length: bots }, (_, i) => (
                  <motion.li key={`empty${i}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 px-3 py-2.5">
                    <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/[0.04] text-ink-400">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink-300">Open seat</div>
                      <div className="text-xs text-ink-400">Computer plays if nobody joins</div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        </div>

        {/* Game settings */}
        <aside className="panel h-fit space-y-5 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="label mb-1">Game</div>
              <div className="font-display text-2xl font-bold">{meta.name}</div>
              <div className="text-xs text-ink-400">{meta.fullName}</div>
            </div>
            <div className="pr-3 pt-2">
              <GameArt game={room.settings.gameId} />
            </div>
          </div>
          {isHost && (
            <Segmented<GameId>
              options={GAME_IDS.map((g) => ({ value: g, label: GAME_META[g].name }))}
              value={room.settings.gameId}
              onChange={(g) => update({ gameId: g, seats: Math.max(humans, Math.min(GAME_META[g].maxPlayers, room.settings.seats)) })}
              size="sm"
            />
          )}
          <div>
            <label className="label">Players at the table</label>
            {isHost ? (
              <SeatStepper value={room.settings.seats} min={Math.max(meta.minPlayers, humans)} max={meta.maxPlayers} humans={humans} onChange={(n) => update({ seats: n })} />
            ) : (
              <div className="font-display text-xl font-bold">{room.settings.seats}</div>
            )}
          </div>
          <GameSettingsFields game={room.settings.gameId} values={room.settings.game} onChange={(k, v) => update({ game: { ...room.settings.game, [k]: v } })} disabled={!isHost} />
          <div>
            <label className="label flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" /> Turn timer
            </label>
            <Segmented options={TURN_TIMER_OPTIONS.map((o) => ({ value: o.value as number, label: o.label }))} value={room.settings.turnTimer} onChange={(v) => update({ turnTimer: v })} disabled={!isHost} size="sm" />
          </div>
          {!isHost && <p className="text-xs text-ink-400">Only the host can change settings.</p>}
        </aside>
      </main>

      {/* Start bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-ink-950/85 backdrop-blur-xl" style={{ paddingBottom: "var(--safe-bottom)" }}>
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="hidden min-w-0 flex-1 text-sm text-ink-300 sm:block">
            {humans} player{humans === 1 ? "" : "s"}
            {bots > 0 && ` + ${bots} computer${bots === 1 ? "" : "s"}`}
          </div>
          {isHost ? (
            <button className="btn-primary h-12 flex-1 text-base sm:flex-none sm:px-10" onClick={() => conn.send({ type: "start" })} disabled={conn.busy}>
              Start game
              <span className="text-sm font-medium opacity-70">
                · {humans}
                {bots ? ` + ${bots}` : ""}
                {bots ? <Bot className="ml-0.5 inline h-4 w-4 -translate-y-px" /> : null}
              </span>
            </button>
          ) : (
            <div className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-white/[0.04] text-sm text-ink-300 sm:flex-none sm:px-8">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gold-400" /> Waiting for {host?.name ?? "the host"} to start…
            </div>
          )}
        </div>
      </div>

      <Modal open={qr} onClose={() => setQr(false)} title="Scan to join">
        <div className="flex flex-col items-center gap-4 p-6">
          {link && <QrCode value={link} size={220} />}
          <p className="text-center text-sm text-ink-300">
            Point a phone camera here to open the room. Code <b className="font-mono tracking-widest text-gold-300">{room.code}</b>
          </p>
        </div>
      </Modal>
      <ChatDrawer
        open={chat}
        onClose={() => setChat(false)}
        chat={room.chat}
        log={[]}
        meId={meId}
        showChat
        onSend={(text) => void conn.send({ type: "chat", text })}
        onReact={(emoji) => void conn.send({ type: "react", emoji })}
      />
    </div>
  );
}
