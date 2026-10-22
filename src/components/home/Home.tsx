"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Bot, Clock, Link2, LogIn, Play, Smartphone, TriangleAlert, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GAME_IDS, GAME_META } from "@/games/registry";
import { GameId } from "@/games/types";
import { load, LOCAL_ROOM_KEY } from "@/lib/client/storage";
import { Logo } from "../ui/Logo";
import { Modal } from "../ui/Modal";
import { RulesContent } from "../Rules";
import { GameArt } from "./GameArt";
import { SetupMode, SetupSheet } from "./SetupSheet";

const FELT: Record<GameId, string> = { poker: "felt", rummy: "felt-rummy", uno: "felt-uno" };

function JoinBox() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (clean.length === 5) router.push(`/room/${clean}`);
    else inputRef.current?.focus();
  };
  return (
    <form onSubmit={go} className="panel flex w-full max-w-md items-center gap-2 p-2">
      <div className="pl-3 text-ink-400">
        <LogIn className="h-5 w-5" />
      </div>
      <input
        ref={inputRef}
        value={clean}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter room code"
        aria-label="Room code"
        className="min-w-0 flex-1 bg-transparent py-2.5 font-display text-lg font-semibold uppercase tracking-[0.3em] text-ink-100 outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-400"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
      />
      <button type="submit" className={clsx("btn h-11 px-5", clean.length === 5 ? "btn-primary" : "btn-secondary")}>
        Join
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

function GameTile({ game, onPlay, onRules, index }: { game: GameId; onPlay: (g: GameId, m: SetupMode) => void; onRules: (g: GameId) => void; index: number }) {
  const meta = GAME_META[game];
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08, type: "spring", stiffness: 200, damping: 26 }}
      className="panel group flex flex-col overflow-hidden"
    >
      <div className={clsx("felt-texture relative flex h-44 items-center justify-center overflow-hidden", FELT[game])}>
        <div className="transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-[1.04]">
          <GameArt game={game} size="lg" />
        </div>
        <div className="absolute left-4 top-4 flex gap-1.5">
          <span className="chip bg-black/30 text-ink-100 backdrop-blur">
            <Users className="h-3 w-3" /> {meta.minPlayers}–{meta.maxPlayers}
          </span>
          <span className="chip bg-black/30 text-ink-100 backdrop-blur">
            <Clock className="h-3 w-3" /> {meta.duration}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-xl font-bold">{meta.name}</h3>
          <button onClick={() => onRules(game)} className="inline-flex items-center gap-1 text-xs font-medium text-ink-400 transition hover:text-gold-400">
            <BookOpen className="h-3.5 w-3.5" /> Rules
          </button>
        </div>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-ink-400">{meta.fullName}</p>
        <p className="mt-3 flex-1 text-sm text-ink-300">{meta.tagline}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="btn-primary" onClick={() => onPlay(game, "friends")}>
            <Users className="h-4 w-4" /> With friends
          </button>
          <button className="btn-secondary" onClick={() => onPlay(game, "computer")}>
            <Bot className="h-4 w-4" /> vs Computer
          </button>
        </div>
      </div>
    </motion.article>
  );
}

const STEPS = [
  { icon: Users, title: "Create a room", body: "Pick a game and how many seats. You'll get a 5-letter room code." },
  { icon: Link2, title: "Share the code", body: "Friends open the link (or scan the QR) and type their name. That's it — no accounts." },
  { icon: Bot, title: "Computer fills the gaps", body: "Start whenever you like. Any empty seats are taken by computer players." },
];

export function Home() {
  const [setup, setSetup] = useState<{ game: GameId; mode: SetupMode } | null>(null);
  const [rules, setRules] = useState<GameId | null>(null);
  const [resume, setResume] = useState<GameId | null>(null);
  const [warning, setWarning] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const local = load<{ game?: { gameId: GameId; over: boolean } } | null>(LOCAL_ROOM_KEY, null);
    if (local?.game && !local.game.over) setResume(local.game.gameId);
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setWarning(h.storage === "memory" && h.hosted))
      .catch(() => {});
  }, []);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <Smartphone className="hidden h-4 w-4 sm:block" />
          <span className="hidden sm:inline">Works on phones, tablets & laptops</span>
        </div>
      </header>

      {warning && (
        <div className="mx-auto mb-2 max-w-6xl px-4 sm:px-6">
          <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Online rooms need a Redis database on this deployment. Add the <b>Upstash Redis</b> integration in Vercel and redeploy. Playing vs computer works already.
            </span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="grid items-center gap-10 pb-12 pt-6 lg:grid-cols-[1.15fr_.85fr] lg:pb-16 lg:pt-12">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="chip mb-5 border border-gold-400/20 bg-gold-400/10 px-3 py-1 text-xs text-gold-300">Poker · Rummy · UNO — free, no sign-up</div>
            <h1 className="font-display text-[44px] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Card night,
              <br />
              <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-600 bg-clip-text text-transparent">anywhere.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-ink-300 sm:text-lg">
              Start a table in seconds, share a code with friends, and play together from any phone or laptop. Short on players? Computer opponents take the empty seats.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <JoinBox />
              {resume && (
                <button onClick={() => router.push("/play")} className="inline-flex w-fit items-center gap-2 text-sm font-medium text-gold-400 transition hover:text-gold-300">
                  <Play className="h-4 w-4" /> Resume your {GAME_META[resume].name} game vs computer
                </button>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative mx-auto hidden aspect-[5/4] w-full max-w-md sm:block"
          >
            <div className="felt felt-texture rail absolute inset-6 rounded-[48%]" />
            <motion.div className="absolute left-[8%] top-[18%]" animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
              <GameArt game="poker" size="lg" />
            </motion.div>
            <motion.div className="absolute right-[6%] top-[12%]" animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}>
              <GameArt game="uno" />
            </motion.div>
            <motion.div className="absolute bottom-[10%] left-[34%]" animate={{ y: [0, -6, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.6 }}>
              <GameArt game="rummy" />
            </motion.div>
          </motion.div>
        </section>

        <section aria-labelledby="games">
          <div className="mb-5 flex items-end justify-between">
            <h2 id="games" className="font-display text-2xl font-bold">
              Choose a game
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {GAME_IDS.map((g, i) => (
              <GameTile key={g} game={g} index={i} onPlay={(game, mode) => setSetup({ game, mode })} onRules={setRules} />
            ))}
          </div>
        </section>

        <section className="mt-16" aria-labelledby="how">
          <h2 id="how" className="mb-5 font-display text-2xl font-bold">
            How it works
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="panel p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-400/10 text-gold-400">
                    <s.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-xs font-semibold text-ink-400">STEP {i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-base font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-300">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.05] py-6 text-center text-xs text-ink-400">Card Club · Play for fun — no real money involved.</footer>

      <SetupSheet game={setup?.game ?? null} mode={setup?.mode ?? "friends"} onClose={() => setSetup(null)} />
      <Modal open={!!rules} onClose={() => setRules(null)} title={rules ? `How to play ${GAME_META[rules].name}` : ""}>
        {rules && <RulesContent game={rules} />}
      </Modal>
    </div>
  );
}
