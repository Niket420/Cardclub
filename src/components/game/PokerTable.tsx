"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PokerSeatView, PokerView } from "@/games/poker/engine";
import { useSecondsLeft } from "@/lib/client/hooks";
import { buzz, play } from "@/lib/client/sound";
import { PlayingCard } from "../cards/PlayingCard";
import { Chip } from "../home/GameArt";
import { Avatar } from "../ui/Avatar";
import { rotateToMe, Seat, StatusPill, useSeatPositions } from "./Seat";
import { TimerBar } from "./TurnRing";
import { TableCtx } from "./types";

const fmt = (n: number) => n.toLocaleString("en-US");

type PreAction = "checkfold" | "check" | "callany" | null;

function chipColor(amount: number, bb: number) {
  const r = amount / bb;
  if (r >= 50) return "#111827";
  if (r >= 10) return "#7c3aed";
  if (r >= 4) return "#16a34a";
  if (r >= 2) return "#1f6fd8";
  return "#d0263e";
}

function BetStack({ amount, bb }: { amount: number; bb: number }) {
  const count = Math.min(4, Math.max(1, Math.ceil(Math.log2(amount / bb + 1))));
  return (
    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="flex items-center gap-1">
      <div className="relative flex flex-col-reverse">
        {Array.from({ length: count }, (_, i) => (
          <Chip key={i} color={chipColor(amount, bb)} size={18} className={i ? "-mb-[14px]" : ""} />
        ))}
      </div>
      <span className="rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] font-bold text-gold-300 tabular">{fmt(amount)}</span>
    </motion.div>
  );
}

function actionTone(a: string | null): "neutral" | "good" | "bad" | "gold" | "info" {
  if (!a) return "neutral";
  if (a.startsWith("Fold")) return "bad";
  if (a.startsWith("All")) return "gold";
  if (a.startsWith("Raise") || a.startsWith("Bet")) return "gold";
  if (a.startsWith("Call") || a.startsWith("Check")) return "info";
  return "neutral";
}

function DealerButton() {
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-ink-950 shadow ring-1 ring-black/20">D</span>;
}

function SeatCards({ p, highlight }: { p: PokerSeatView; highlight: Set<string> }) {
  if (!p.cards.length || p.out) return null;
  const revealed = p.cards.some(Boolean);
  if (p.folded && !revealed) return null;
  return (
    <div className="flex">
      {p.cards.map((c, i) => (
        <motion.div key={c?.id ?? `b${i}`} initial={{ rotateY: revealed ? 90 : 0, y: revealed ? 0 : -8, opacity: revealed ? 1 : 0 }} animate={{ rotateY: 0, y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }}>
          <PlayingCard
            card={c}
            size={revealed ? "sm" : "xs"}
            className={clsx(i ? (revealed ? "-ml-[22px]" : "-ml-4") : "", i ? "rotate-6" : "-rotate-6")}
            highlight={!!c && highlight.has(c.id)}
            dimmed={revealed && highlight.size > 0 && !!c && !highlight.has(c.id)}
          />
        </motion.div>
      ))}
    </div>
  );
}

export function PokerTable({ view, meId, act, offset, deadline, turnStartedAt, advanceAt, online, reactions, local, busy }: TableCtx<PokerView>) {
  const seats = rotateToMe(view.players, meId);
  const me = seats[0]?.id === meId ? seats[0] : null;
  const others = me ? seats.slice(1) : seats;
  const positions = useSeatPositions(others.length);
  const myTurn = !!view.actions;
  const result = view.result;
  const handover = view.street === "handover";
  const nextIn = useSecondsLeft(handover ? advanceAt : null, offset);

  const winners = useMemo(() => new Set(result ? Object.keys(result.won) : []), [result]);
  const highlight = useMemo(() => {
    if (!result?.showdown) return new Set<string>();
    const ids = new Set<string>();
    for (const pot of result.pots.slice(0, 1)) for (const w of pot.winners) result.bestCards[w]?.forEach((id) => ids.add(id));
    return ids;
  }, [result]);

  // ---- Sounds ----
  const lastLog = view.log[view.log.length - 1] ?? "";
  const prevLog = useRef(lastLog);
  useEffect(() => {
    if (lastLog === prevLog.current) return;
    prevLog.current = lastLog;
    if (/raises|bets|calls|all-in/.test(lastLog)) play("chip");
    else if (/folds|checks/.test(lastLog)) play("card");
    else if (/deals/.test(lastLog)) play("deal");
    else if (/wins/.test(lastLog)) play(meId && result && result.won[meId] ? "win" : "chip");
  }, [lastLog, meId, result]);
  const boardLen = view.board.length;
  useEffect(() => {
    if (boardLen) play("deal");
  }, [boardLen]);

  // ---- Pre-actions ----
  const [pre, setPre] = useState<PreAction>(null);
  const streetKey = `${view.handNo}:${view.street}`;
  const meBet = me?.bet ?? 0;
  const maxBet = Math.max(0, ...view.players.map((p) => p.bet));
  useEffect(() => setPre(null), [streetKey]);
  useEffect(() => {
    if (pre === "check" && maxBet > meBet) setPre(null);
  }, [pre, maxBet, meBet]);
  useEffect(() => {
    if (!myTurn || !pre || !view.actions) return;
    const a = view.actions;
    const chosen = pre;
    setPre(null);
    if (chosen === "checkfold") void act(a.canCheck ? { type: "check" } : { type: "fold" });
    else if (chosen === "check" && a.canCheck) void act({ type: "check" });
    else if (chosen === "callany") void act(a.canCall ? { type: "call" } : { type: "check" });
  }, [myTurn, pre, view.actions, act]);

  // ---- My turn ----
  useEffect(() => {
    if (myTurn) {
      play("turn");
      buzz([20, 40, 20]);
    }
  }, [myTurn, view.handNo]);

  const winLine = useMemo(() => {
    if (!result) return null;
    const main = result.pots[0];
    if (!main) return null;
    const names = main.winners.map((id) => (id === meId ? "You" : view.players.find((p) => p.id === id)?.name ?? "?"));
    const verb = names.length === 1 && names[0] === "You" ? "win" : names.length > 1 ? "split" : "wins";
    const amount = main.winners.length > 1 ? main.amount : result.won[main.winners[0]];
    return { text: `${names.join(" & ")} ${verb} ${fmt(amount)}`, hand: main.handName, extra: result.pots.length > 1 ? `+${result.pots.length - 1} side pot${result.pots.length > 2 ? "s" : ""}` : null };
  }, [result, meId, view.players]);

  return (
    <div className="flex h-full flex-col">
      {/* Table */}
      <div className="relative min-h-0 flex-1">
        <div className="felt felt-texture rail absolute inset-x-[5%] inset-y-[9%] rounded-[999px] sm:inset-x-[9%]" />

        {/* Center */}
        <div className="absolute left-1/2 top-[47%] z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2.5">
          <AnimatePresence>
            {view.pot > 0 && (
              <motion.div key="pot" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 py-1 pl-1.5 pr-3 backdrop-blur">
                <Chip color="#ebb53f" size={18} />
                <span className="text-xs font-semibold text-ink-300">Pot</span>
                <motion.span key={view.pot} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="text-sm font-bold text-gold-300 tabular">
                  {fmt(view.pot)}
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-1 sm:gap-1.5">
            {Array.from({ length: 5 }, (_, i) => {
              const c = view.board[i];
              return c ? (
                <motion.div key={c.id} initial={{ rotateY: 90, y: -12, opacity: 0 }} animate={{ rotateY: 0, y: 0, opacity: 1 }} transition={{ delay: (i < 3 ? i : 0) * 0.12, type: "spring", stiffness: 260, damping: 22 }}>
                  <PlayingCard card={c} size="md" highlight={highlight.has(c.id)} dimmed={highlight.size > 0 && !highlight.has(c.id)} />
                </motion.div>
              ) : (
                <div key={`slot${i}`} className="rounded-[calc(var(--w)*0.09)] border border-dashed border-white/15 bg-black/10" style={{ ["--w" as string]: "clamp(44px, 11.5vw, 66px)", width: "var(--w)", height: "calc(var(--w) * 1.4)" }} />
              );
            })}
          </div>
          <div className="h-12">
            <AnimatePresence mode="wait">
              {handover && winLine ? (
                <motion.div key="win" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                  <span className="rounded-full bg-gradient-to-b from-gold-300 to-gold-500 px-4 py-1 text-sm font-bold text-ink-950 shadow-glow">{winLine.text}</span>
                  <span className="mt-1 text-[11px] font-medium text-ink-200 text-shadow">
                    {[winLine.hand, winLine.extra, nextIn !== null ? `Next hand in ${nextIn}s` : null].filter(Boolean).join(" · ")}
                  </span>
                </motion.div>
              ) : view.runout ? (
                <motion.span key="runout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-gold-300">
                  All-in — running it out
                </motion.span>
              ) : (
                <motion.span key="blinds" initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} className="text-[11px] font-medium uppercase tracking-widest text-white/50">
                  {view.street === "preflop" ? "Pre-flop" : view.street} · Blinds {fmt(view.sb)}/{fmt(view.bb)}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Opponents */}
        {others.map((p, i) => {
          const pos = positions[i];
          const leftSide = pos.x > 50;
          const betPos = { x: pos.x + (50 - pos.x) * 0.42, y: pos.y + (47 - pos.y) * 0.42 };
          const won = result?.won[p.id];
          return (
            <div key={p.id}>
              <div className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                <div className={clsx("relative flex items-center", leftSide ? "flex-row-reverse" : "flex-row")}>
                  <Seat
                    id={p.id}
                    name={p.name}
                    bot={p.isBot}
                    active={view.toActId === p.id}
                    deadline={deadline}
                    startedAt={turnStartedAt}
                    offset={offset}
                    subtitle={p.out ? "Out" : p.allIn ? "All-in" : fmt(p.chips)}
                    badge={p.isDealer ? <DealerButton /> : undefined}
                    status={
                      won ? (
                        <StatusPill text={`+${fmt(won)}`} tone="good" />
                      ) : handover && result?.handNames[p.id] && !p.folded ? (
                        <StatusPill text={result.handNames[p.id].split(",")[0]} />
                      ) : p.lastAction ? (
                        <StatusPill text={p.lastAction} tone={actionTone(p.lastAction)} />
                      ) : null
                    }
                    dimmed={p.out || (p.folded && !handover)}
                    offline={!p.isBot && online[p.id] === false}
                    reaction={reactions[p.id]}
                    winner={!!won && handover}
                  />
                  <div className={clsx("absolute top-3", leftSide ? "right-[calc(100%-14px)]" : "left-[calc(100%-14px)]")}>
                    <SeatCards p={p} highlight={highlight} />
                  </div>
                </div>
              </div>
              <AnimatePresence>
                {p.bet > 0 && (
                  <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${betPos.x}%`, top: `${betPos.y}%` }}>
                    <BetStack amount={p.bet} bb={view.bb} />
                  </div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* My bet */}
        <AnimatePresence>
          {me && me.bet > 0 && (
            <div className="absolute left-1/2 top-[76%] z-10 -translate-x-1/2">
              <BetStack amount={me.bet} bb={view.bb} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Me */}
      {me ? (
        <MyPanel view={view} me={me} act={act} myTurn={myTurn} deadline={deadline} turnStartedAt={turnStartedAt} offset={offset} pre={pre} setPre={setPre} highlight={highlight} reaction={reactions[me.id]} busy={busy} local={local} />
      ) : (
        <div className="py-4 text-center text-sm text-ink-400">Spectating</div>
      )}
    </div>
  );
}

function MyPanel({
  view,
  me,
  act,
  myTurn,
  deadline,
  turnStartedAt,
  offset,
  pre,
  setPre,
  highlight,
  reaction,
  busy,
}: {
  view: PokerView;
  me: PokerSeatView;
  act: (a: unknown) => Promise<boolean>;
  myTurn: boolean;
  deadline: number | null;
  turnStartedAt: number;
  offset: number;
  pre: PreAction;
  setPre: (p: PreAction) => void;
  highlight: Set<string>;
  reaction?: { id: string; emoji: string };
  busy: boolean;
  local: boolean;
}) {
  const a = view.actions;
  const [raising, setRaising] = useState(false);
  const [amount, setAmount] = useState(0);
  const won = view.result?.won[me.id];
  const handover = view.street === "handover";

  useEffect(() => {
    if (!myTurn) setRaising(false);
    if (a) setAmount(a.minRaiseTo);
  }, [myTurn, a?.minRaiseTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const potRaise = (f: number) => {
    if (!a) return 0;
    const toCall = a.currentBet - a.myBet;
    const to = Math.round(a.currentBet + f * (view.pot + toCall));
    return Math.max(a.minRaiseTo, Math.min(a.maxRaiseTo, to));
  };

  const doAct = async (x: unknown) => {
    buzz(10);
    setRaising(false);
    await act(x);
  };

  // Desktop shortcuts: F fold, C check/call, R raise, Enter confirm raise.
  useEffect(() => {
    if (!a) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== "range") return;
      const k = e.key.toLowerCase();
      if (k === "f" && !a.canCheck) void doAct({ type: "fold" });
      else if (k === "c") void doAct(a.canCheck ? { type: "check" } : { type: "call" });
      else if (k === "r" && a.canRaise) setRaising((r) => !r);
      else if (k === "enter" && raising) void doAct(amount >= a.maxRaiseTo ? { type: "allin" } : { type: "raise", to: amount });
      else if (k === "escape") setRaising(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const step = Math.max(1, view.sb);
  const raiseLabel = a && a.currentBet === 0 ? "Bet" : "Raise to";
  const inHand = !me.folded && !me.out && me.cards.length > 0;

  return (
    <div className="relative z-30 border-t border-white/[0.06] bg-gradient-to-b from-ink-900/90 to-ink-950 px-3 pt-2 sm:px-6" style={{ paddingBottom: "calc(10px + var(--safe-bottom))" }}>
      <div className="mx-auto flex max-w-3xl items-end gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className={clsx("relative rounded-full", myTurn && "ring-[3px] ring-gold-400 ring-offset-2 ring-offset-ink-900")}>
            <Avatar id={me.id} name={me.name} size={40} />
            {me.isDealer && (
              <span className="absolute -right-1.5 -top-1">
                <DealerButton />
              </span>
            )}
            <AnimatePresence>
              {reaction && (
                <motion.span key={reaction.id} initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 1, 1, 0], y: -40 }} transition={{ duration: 2.6 }} className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-3xl">
                  {reaction.emoji}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{me.name}</div>
            <div className="flex items-center gap-1 text-sm font-bold text-gold-300 tabular">
              <Chip size={14} color="#ebb53f" />
              {fmt(me.chips)}
            </div>
          </div>
        </div>

        <div className="-mt-12 flex shrink-0 sm:-mt-16">
          {me.cards.map((c, i) => (
            <motion.div key={c?.id ?? i} initial={{ y: 40, opacity: 0, rotate: 0 }} animate={{ y: 0, opacity: 1, rotate: i ? 5 : -5 }} transition={{ delay: i * 0.1, type: "spring", stiffness: 260, damping: 22 }}>
              <PlayingCard card={c} size="xl" className={i ? "-ml-6" : ""} dimmed={me.folded} highlight={!!c && highlight.has(c.id)} />
            </motion.div>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-end text-right">
          {won ? (
            <StatusPill text={`+${fmt(won)}`} tone="good" />
          ) : me.lastAction && !handover ? (
            <StatusPill text={me.lastAction} tone={actionTone(me.lastAction)} />
          ) : null}
          {view.myHandName && <div className="mt-1 max-w-full truncate text-xs font-semibold text-ink-200">{view.myHandName}</div>}
        </div>
      </div>

      <div className="mx-auto mt-2.5 max-w-3xl">
        {myTurn && <TimerBar deadline={deadline} startedAt={turnStartedAt} offset={offset} />}
        <AnimatePresence initial={false}>
          {raising && a && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 rounded-2xl border border-white/[0.07] bg-ink-850 p-3">
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    ["Min", a.minRaiseTo],
                    ["½ Pot", potRaise(0.5)],
                    ["¾ Pot", potRaise(0.75)],
                    ["Pot", potRaise(1)],
                    ["All-in", a.maxRaiseTo],
                  ].map(([label, v]) => (
                    <button key={label} onClick={() => setAmount(v as number)} className={clsx("rounded-lg py-2 text-xs font-semibold transition", amount === v ? "bg-gold-400 text-ink-950" : "bg-white/[0.06] text-ink-200 hover:bg-white/10")}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button className="btn-secondary h-9 w-9 p-0" onClick={() => setAmount((x) => Math.max(a.minRaiseTo, x - step * 2))} aria-label="Less">
                    −
                  </button>
                  <input type="range" min={a.minRaiseTo} max={a.maxRaiseTo} step={step} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="flex-1" aria-label="Raise amount" />
                  <button className="btn-secondary h-9 w-9 p-0" onClick={() => setAmount((x) => Math.min(a.maxRaiseTo, x + step * 2))} aria-label="More">
                    +
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-2.5">
          {a ? (
            <div className="grid grid-cols-3 gap-2">
              {a.canCheck ? (
                <button className="btn-secondary h-12" disabled={busy} onClick={() => doAct({ type: "fold" })} title="Fold (F)">
                  Fold
                </button>
              ) : (
                <button className="btn-danger h-12" disabled={busy} onClick={() => doAct({ type: "fold" })} title="Fold (F)">
                  Fold
                </button>
              )}
              <button className="btn-success h-12" disabled={busy} onClick={() => doAct(a.canCheck ? { type: "check" } : { type: "call" })} title="Check / Call (C)">
                {a.canCheck ? "Check" : a.callAmount >= me.chips ? `All-in ${fmt(a.callAmount)}` : `Call ${fmt(a.callAmount)}`}
              </button>
              {a.canRaise ? (
                raising ? (
                  <button className="btn-primary h-12 flex-col gap-0 leading-tight" disabled={busy} onClick={() => doAct(amount >= a.maxRaiseTo ? { type: "allin" } : { type: "raise", to: amount })}>
                    <span className="text-[11px] font-medium opacity-75">{amount >= a.maxRaiseTo ? "All-in" : raiseLabel}</span>
                    <span className="tabular">{fmt(amount)}</span>
                  </button>
                ) : (
                  <button className="btn-primary h-12" disabled={busy} onClick={() => setRaising(true)} title="Raise (R)">
                    {a.currentBet === 0 ? "Bet" : "Raise"}
                  </button>
                )
              ) : (
                <button className="btn-secondary h-12" disabled>
                  Raise
                </button>
              )}
            </div>
          ) : inHand && !handover && view.street !== "gameover" ? (
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["checkfold", "Check / Fold"],
                  ["check", "Check"],
                  ["callany", "Call any"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setPre(pre === k ? null : k)}
                  className={clsx("btn h-11 border text-xs", pre === k ? "border-gold-400/60 bg-gold-400/15 text-gold-200" : "border-white/[0.07] bg-white/[0.03] text-ink-300 hover:bg-white/[0.06]")}
                >
                  <span className={clsx("h-3.5 w-3.5 rounded border", pre === k ? "border-gold-400 bg-gold-400" : "border-ink-400")} />
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-11 items-center justify-center text-sm text-ink-400">
              {me.out ? "You're out of chips — watching the rest of the game" : me.folded && !handover ? "You folded · waiting for the next hand" : handover ? "Next hand starting…" : "Waiting…"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
