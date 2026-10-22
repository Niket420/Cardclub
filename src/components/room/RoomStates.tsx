"use client";

import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { GAME_META } from "@/games/registry";
import { load, NAME_KEY, save } from "@/lib/client/storage";
import { RoomView } from "@/lib/room";
import { GameArt } from "../home/GameArt";
import { Avatar } from "../ui/Avatar";
import { Logo } from "../ui/Logo";

export function CenterCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6">
        <Logo />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel w-full max-w-md p-6 sm:p-8">
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export function Loading({ text }: { text: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 text-ink-300">
      <Loader2 className="h-6 w-6 animate-spin text-gold-400" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

export function Problem({ title, body }: { title: string; body: string }) {
  return (
    <CenterCard>
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-ink-300">{body}</p>
      <Link href="/" className="btn-primary mt-6 h-11 w-full">
        Back to home
      </Link>
    </CenterCard>
  );
}

export function JoinGate({ room, code, onJoin, busy }: { room: RoomView | null; code: string; onJoin: (name: string) => Promise<boolean>; busy: boolean }) {
  const [name, setName] = useState("");
  useEffect(() => setName(load(NAME_KEY, "")), []);
  if (room && room.status !== "lobby") {
    return <Problem title="Game in progress" body="This table has already started. Ask the host to start a new game after this one, then join again." />;
  }
  const meta = room ? GAME_META[room.settings.gameId] : null;
  const host = room?.players.find((p) => p.id === room.hostId);
  const full = room ? room.players.length >= room.settings.seats : false;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    save(NAME_KEY, n);
    await onJoin(n);
  };
  return (
    <CenterCard>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="label mb-1">You&apos;re invited to</div>
          <h1 className="font-display text-2xl font-bold">{meta ? `${meta.name}` : "a game"}</h1>
          {host && <p className="mt-1 text-sm text-ink-300">Hosted by {host.name}</p>}
        </div>
        {room && (
          <div className="pr-3 pt-1">
            <GameArt game={room.settings.gameId} />
          </div>
        )}
      </div>
      {room && (
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
          <div className="flex -space-x-2">
            {room.players.slice(0, 5).map((p) => (
              <Avatar key={p.id} id={p.id} name={p.name} size={28} className="ring-ink-850" />
            ))}
          </div>
          <span className="text-sm text-ink-300">
            {room.players.length} of {room.settings.seats} seats taken · Room <b className="font-mono tracking-widest text-ink-100">{code}</b>
          </span>
        </div>
      )}
      {full ? (
        <p className="mt-5 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">This room is full. Ask the host to add a seat.</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="label" htmlFor="join-name">
            Your name
          </label>
          <input id="join-name" className="input" autoFocus placeholder="e.g. Arjun" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
          <button className="btn-primary h-12 w-full text-base" disabled={busy || !name.trim()}>
            {busy ? "Joining…" : "Join table"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      )}
    </CenterCard>
  );
}
