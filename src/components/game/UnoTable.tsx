"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Hand, Layers } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { COLOR_NAME, COLORS, UnoCard, UnoColor, UnoView } from "@/games/uno/engine";
import { useSecondsLeft } from "@/lib/client/hooks";
import { buzz, play } from "@/lib/client/sound";
import { UNO_HEX, UnoBack, UnoCardView } from "../cards/UnoCardView";
import { Avatar } from "../ui/Avatar";
import { Modal } from "../ui/Modal";
import { rotateToMe, Seat, StatusPill, useSeatPositions } from "./Seat";
import { TimerBar } from "./TurnRing";
import { TableCtx } from "./types";
import { useCardPx, useFanOverlap } from "./useFan";

const ORDER: Record<string, number> = { R: 0, Y: 1, G: 2, B: 3, W: 4 };
const VALUE_ORDER = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2", "wild", "wild4"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function DirectionRing({ dir, color }: { dir: 1 | -1; color: UnoColor }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[min(62vw,300px)] w-[min(62vw,300px)] -translate-x-1/2 -translate-y-1/2">
      <motion.svg viewBox="0 0 100 100" className="h-full w-full" animate={{ rotate: dir === 1 ? 360 : -360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }}>
        {[0, 120, 240].map((r) => (
          <g key={r} transform={`rotate(${r} 50 50)`}>
            <path d="M50 4 A46 46 0 0 1 88 26" fill="none" stroke={UNO_HEX[color]} strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" />
            <path d={dir === 1 ? "M88 26 l-5.5 -0.6 M88 26 l-1.2 -5.2" : "M50 4 l4.6 -3 M50 4 l4.4 3.4"} stroke={UNO_HEX[color]} strokeOpacity=".6" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        ))}
      </motion.svg>
    </div>
  );
}

function MiniFan({ count }: { count: number }) {
  const shown = Math.min(count, 5);
  return (
    <div className="flex">
      {Array.from({ length: shown }, (_, i) => (
        <UnoBack key={i} size="xs" className={clsx(i && "-ml-[20px]")} style={{ transform: `rotate(${(i - (shown - 1) / 2) * 8}deg)` }} />
      ))}
    </div>
  );
}

export function UnoTable({ view, meId, act, offset, deadline, turnStartedAt, advanceAt, online, reactions, busy }: TableCtx<UnoView>) {
  const seats = rotateToMe(view.players, meId);
  const me = seats[0]?.id === meId ? seats[0] : null;
  const others = me ? seats.slice(1) : seats;
  const positions = useSeatPositions(others.length);
  const myTurn = view.turnId === meId;
  const [wildFor, setWildFor] = useState<string | null>(null);
  const top = view.discard[view.discard.length - 1];
  const playable = useMemo(() => new Set(view.playable), [view.playable]);
  const vulnerable = view.vulnerable && view.vulnerable !== meId ? view.players.find((p) => p.id === view.vulnerable) : null;

  const hand = useMemo(
    () => [...view.hand].sort((a, b) => ORDER[a.color] - ORDER[b.color] || VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value)),
    [view.hand],
  );

  // Sounds
  const lastLog = view.log[view.log.length - 1] ?? "";
  const prev = useRef(lastLog);
  useEffect(() => {
    if (prev.current === lastLog) return;
    prev.current = lastLog;
    if (/UNO!/.test(lastLog) || /caught/.test(lastLog)) play("uno");
    else if (/plays/.test(lastLog)) play("card");
    else if (/draws/.test(lastLog)) play("deal");
    else if (/wins the round/.test(lastLog)) play("win");
    else if (/deals/.test(lastLog)) play("shuffle");
  }, [lastLog]);
  useEffect(() => {
    if (myTurn) {
      play("turn");
      buzz([20, 40, 20]);
    }
  }, [myTurn, top?.id]);

  const playCard = (c: UnoCard) => {
    if (!myTurn || busy) return;
    if (!playable.has(c.id)) {
      play("error");
      return;
    }
    buzz(10);
    if (c.color === "W") setWildFor(c.id);
    else void act({ type: "play", cardId: c.id });
  };

  const handRef = useRef<HTMLDivElement>(null);
  const cardPx = useCardPx(62, 17, 104);
  const { margin } = useFanOverlap(handRef, hand.length, cardPx, 6, 0.32);
  const nextIn = useSecondsLeft(view.phase === "roundover" ? advanceAt : null, offset);

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <div className="felt-uno felt-texture rail absolute inset-x-[5%] inset-y-[9%] rounded-[999px] sm:inset-x-[9%]" />
        <DirectionRing dir={view.dir} color={view.color} />

        {/* Center */}
        <div className="absolute left-1/2 top-[47%] z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <div className="flex items-center gap-5 sm:gap-8">
            <button
              onClick={() => myTurn && !view.drawnCardId && !busy && act({ type: "draw" })}
              disabled={!myTurn || !!view.drawnCardId}
              className={clsx("relative rounded-[12px] transition", myTurn && !view.drawnCardId && "animate-pulse-ring hover:-translate-y-1")}
              aria-label="Draw a card"
            >
              <div className="absolute left-[3px] top-[3px] opacity-60">
                <UnoBack size="md" />
              </div>
              <UnoBack size="md" />
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2 text-[10px] font-bold text-ink-200">{view.deckCount}</span>
            </button>
            <div className="relative" style={{ width: "clamp(44px, 11.5vw, 66px)", height: "calc(clamp(44px, 11.5vw, 66px) * 1.5)" }}>
              <div
                className="absolute -inset-3 rounded-[22px] opacity-70 blur-xl transition-colors duration-500"
                style={{ background: UNO_HEX[view.color] }}
              />
              {view.discard.slice(0, -1).map((c) => (
                <div key={c.id} className="absolute inset-0" style={{ transform: `rotate(${(hash(c.id) % 36) - 18}deg)` }}>
                  <UnoCardView card={c} size="md" />
                </div>
              ))}
              <AnimatePresence>
                {top && (
                  <motion.div
                    key={top.id}
                    layoutId={`uno-${top.id}`}
                    initial={{ scale: 1.5, opacity: 0, rotate: -30 }}
                    animate={{ scale: 1, opacity: 1, rotate: (hash(top.id) % 36) - 18 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                    className="absolute inset-0"
                  >
                    <UnoCardView card={top} size="md" />
                  </motion.div>
                )}
              </AnimatePresence>
              {top?.color === "W" && (
                <span className="absolute -right-3 -top-3 z-10 h-6 w-6 rounded-full ring-[3px] ring-white" style={{ background: UNO_HEX[view.color] }} title={`Color: ${COLOR_NAME[view.color]}`} />
              )}
              <AnimatePresence>
                {view.pendingDraw > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute -bottom-3 -right-4 z-10 rounded-full bg-rose-500 px-2 py-0.5 text-sm font-black text-white shadow-lg">
                    +{view.pendingDraw}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="mt-5 flex h-6 max-w-[70vw] items-center justify-center">
            <motion.span key={lastLog} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="truncate rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-ink-100">
              {lastLog}
            </motion.span>
          </div>
        </div>

        {/* Opponents */}
        {others.map((p, i) => {
          const pos = positions[i];
          const leftSide = pos.x > 50;
          return (
            <div key={p.id} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
              <div className={clsx("relative flex items-center", leftSide ? "flex-row-reverse" : "flex-row")}>
                <Seat
                  id={p.id}
                  name={p.name}
                  bot={p.isBot}
                  active={view.turnId === p.id}
                  deadline={deadline}
                  startedAt={turnStartedAt}
                  offset={offset}
                  subtitle={`${p.cardCount} card${p.cardCount === 1 ? "" : "s"}${view.target ? ` · ${p.score} pts` : ""}`}
                  badge={p.cardCount === 1 && p.calledUno ? <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black italic text-white shadow">UNO</span> : undefined}
                  status={view.vulnerable === p.id ? <StatusPill text="Forgot UNO!" tone="bad" /> : null}
                  offline={!p.isBot && online[p.id] === false}
                  reaction={reactions[p.id]}
                  winner={view.result?.winnerId === p.id}
                />
                <div className={clsx("absolute top-2 hidden sm:block", leftSide ? "right-[calc(100%-12px)]" : "left-[calc(100%-12px)]")}>
                  <MiniFan count={p.cardCount} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* My area */}
      {me && (
        <div className="relative z-30 border-t border-white/[0.06] bg-gradient-to-b from-ink-900/90 to-ink-950 px-3 pt-2 sm:px-6" style={{ paddingBottom: "calc(10px + var(--safe-bottom))" }}>
          <div className="mx-auto max-w-4xl">
            <div className="mb-2 flex items-center gap-2.5">
              <div className={clsx("relative rounded-full", myTurn && "ring-[3px] ring-gold-400 ring-offset-2 ring-offset-ink-900")}>
                <Avatar id={me.id} name={me.name} size={34} />
                <AnimatePresence>
                  {reactions[me.id] && (
                    <motion.span key={reactions[me.id].id} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0], y: -40 }} transition={{ duration: 2.6 }} className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-3xl">
                      {reactions[me.id].emoji}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {myTurn ? (view.pendingDraw ? `Stack a card or draw ${view.pendingDraw}` : view.drawnCardId ? "Play the card you drew, or keep it" : "Your turn") : `${view.players.find((p) => p.id === view.turnId)?.name ?? "Someone"}'s turn`}
                </div>
                <div className="text-xs text-ink-400">
                  {me.cardCount} card{me.cardCount === 1 ? "" : "s"}
                  {view.target ? ` · ${me.score} / ${view.target} pts` : ""}
                </div>
              </div>
              <AnimatePresence>
                {view.canCallUno && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    onClick={() => {
                      buzz(30);
                      void act({ type: "uno" });
                    }}
                    className="animate-pulse-ring rounded-2xl bg-gradient-to-b from-rose-400 to-rose-600 px-5 py-2.5 font-display text-lg font-black italic text-white shadow-lg"
                  >
                    UNO!
                  </motion.button>
                )}
                {vulnerable && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    onClick={() => act({ type: "catch", targetId: vulnerable.id })}
                    className="rounded-2xl bg-gradient-to-b from-gold-300 to-gold-500 px-4 py-2.5 text-sm font-bold text-ink-950 shadow-glow"
                  >
                    <Hand className="mr-1 inline h-4 w-4" />
                    Catch {vulnerable.name}!
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            {myTurn && <TimerBar deadline={deadline} startedAt={turnStartedAt} offset={offset} />}

            <div ref={handRef} className="flex justify-center pb-1 pt-4">
              {hand.map((c, i) => {
                  const can = myTurn && playable.has(c.id);
                  return (
                    <motion.button
                      key={c.id}
                      layoutId={`uno-${c.id}`}
                      initial={{ y: 60, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 320, damping: 28 }}
                      onClick={() => playCard(c)}
                      className={clsx("relative shrink-0 transition-transform", can && "hover:-translate-y-3", c.id === view.drawnCardId && "-translate-y-3")}
                      style={{ marginLeft: i ? margin : 0, zIndex: i }}
                      aria-label={c.color === "W" ? c.value : `${c.color} ${c.value}`}
                    >
                      <UnoCardView card={c} size="xl" lifted={can} dimmed={myTurn && !can} highlight={c.id === view.drawnCardId} />
                    </motion.button>
                  );
                })}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {view.drawnCardId ? (
                <>
                  <button className="btn-secondary h-11" disabled={busy} onClick={() => act({ type: "pass" })}>
                    Keep card
                  </button>
                  <button className="btn-primary h-11" disabled={busy} onClick={() => playCard(hand.find((c) => c.id === view.drawnCardId)!)}>
                    Play it
                  </button>
                </>
              ) : (
                <button className={clsx("col-span-2 h-11", myTurn ? (view.playable.length ? "btn-secondary" : "btn-primary") : "btn-secondary")} disabled={!myTurn || busy} onClick={() => act({ type: "draw" })}>
                  <Layers className="h-4 w-4" />
                  {view.pendingDraw ? `Draw ${view.pendingDraw}` : myTurn && !view.playable.length ? "No match — draw a card" : "Draw a card"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wild color picker */}
      <Modal open={!!wildFor} onClose={() => setWildFor(null)} title="Choose a color">
        <div className="grid grid-cols-2 gap-3 p-5">
          {COLORS.map((col) => (
            <button
              key={col}
              onClick={() => {
                const id = wildFor!;
                setWildFor(null);
                void act({ type: "play", cardId: id, color: col });
              }}
              className="flex h-20 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-lg transition hover:scale-[1.03] active:scale-95"
              style={{ background: `linear-gradient(160deg, ${UNO_HEX[col]}, ${UNO_HEX[col]}cc)` }}
            >
              {COLOR_NAME[col]}
              <span className="ml-2 text-sm font-medium opacity-80">({hand.filter((c) => c.color === col).length})</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Round result */}
      <Modal open={view.phase === "roundover" && !!view.result} title="Round over">
        {view.result && (
          <div className="p-5">
            <div className="flex items-center gap-3 rounded-2xl bg-gold-400/10 p-4 ring-1 ring-gold-400/30">
              <Avatar id={view.result.winnerId} name={view.players.find((p) => p.id === view.result!.winnerId)?.name ?? "?"} size={44} />
              <div>
                <div className="font-display text-lg font-bold">{view.result.winnerId === meId ? "You win the round!" : `${view.players.find((p) => p.id === view.result!.winnerId)?.name} wins the round`}</div>
                <div className="text-sm text-gold-300">+{view.result.points} points</div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {view.result.hands.map((h) => (
                <div key={h.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
                  <span className="w-24 truncate text-sm font-semibold">{h.id === meId ? "You" : h.name}</span>
                  <div className="no-scrollbar flex min-w-0 flex-1 overflow-x-auto py-1">
                    {h.cards.map((c, i) => (
                      <UnoCardView key={c.id} card={c} size="xs" className={i ? "-ml-2" : ""} />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-ink-300 tabular">{h.points}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-white/[0.04] p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Scores · first to {view.target}</div>
              {[...view.players]
                .sort((a, b) => b.score - a.score)
                .map((p) => (
                  <div key={p.id} className="flex justify-between py-0.5 text-sm">
                    <span>{p.id === meId ? "You" : p.name}</span>
                    <span className="font-semibold tabular">{p.score}</span>
                  </div>
                ))}
            </div>
            <p className="mt-4 text-center text-sm text-ink-400">Next round in {nextIn ?? 0}s…</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
