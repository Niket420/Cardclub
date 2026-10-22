"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownToLine, Check, CircleSlash, Flag, Layers, Plus, Rows3, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, rankLabel, rankName } from "@/games/cards";
import { DealResult, RummyView } from "@/games/rummy/engine";
import { cardPoints, classifyMeld, isJoker, MELD_LABEL, MeldKind } from "@/games/rummy/melds";
import { useMediaQuery, useSecondsLeft } from "@/lib/client/hooks";
import { useCardPx } from "./useFan";
import { buzz, play } from "@/lib/client/sound";
import { load, save } from "@/lib/client/storage";
import { CardBack, PlayingCard } from "../cards/PlayingCard";
import { Avatar } from "../ui/Avatar";
import { Modal } from "../ui/Modal";
import { rotateToMe, Seat, StatusPill, useSeatPositions } from "./Seat";
import { TimerBar } from "./TurnRing";
import { TableCtx } from "./types";

const SUIT_ORDER: Record<string, number> = { S: 0, H: 1, C: 2, D: 3, X: 4 };

function sortBySuit(cards: Card[], wildRank: number): string[][] {
  const jokers = cards.filter((c) => isJoker(c, wildRank));
  const rest = cards.filter((c) => !isJoker(c, wildRank));
  const groups: string[][] = [];
  for (const s of ["S", "H", "C", "D"]) {
    const g = rest.filter((c) => c.suit === s).sort((a, b) => a.rank - b.rank);
    if (g.length) groups.push(g.map((c) => c.id));
  }
  if (jokers.length) groups.push(jokers.map((c) => c.id));
  return groups;
}

function sortGroup(ids: string[], byId: Map<string, Card>): string[] {
  return [...ids].sort((a, b) => {
    const x = byId.get(a)!;
    const y = byId.get(b)!;
    return SUIT_ORDER[x.suit] - SUIT_ORDER[y.suit] || x.rank - y.rank;
  });
}

/** The player's own arrangement of their hand, kept on this device per deal. */
function useGroups(hand: Card[], wildRank: number, key: string) {
  const [state, setState] = useState<{ key: string; groups: string[][] }>({ key: "", groups: [] });
  const ids = hand.map((c) => c.id).join(",");

  useEffect(() => {
    setState((prev) => {
      const base = prev.key === key ? prev.groups : load<string[][] | null>(key, null) ?? [];
      const inHand = new Set(hand.map((c) => c.id));
      const kept = base.map((g) => g.filter((id) => inHand.has(id))).filter((g) => g.length);
      if (!kept.length) return { key, groups: sortBySuit(hand, wildRank) };
      const placed = new Set(kept.flat());
      const fresh = hand.filter((c) => !placed.has(c.id)).map((c) => c.id);
      return { key, groups: fresh.length ? [...kept, fresh] : kept };
    });
  }, [ids, key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.key && state.groups.length) save(state.key, state.groups);
  }, [state]);

  const setGroups = (fn: string[][] | ((g: string[][]) => string[][])) =>
    setState((prev) => ({ key: prev.key, groups: typeof fn === "function" ? fn(prev.groups) : fn }));
  return [state.groups, setGroups] as const;
}

const KIND_STYLE: Record<MeldKind | "invalid", string> = {
  pure: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/30",
  impure: "bg-sky-500/20 text-sky-200 ring-sky-400/30",
  set: "bg-violet-500/20 text-violet-200 ring-violet-400/30",
  invalid: "bg-white/[0.06] text-ink-300 ring-white/10",
};

function MeldRow({ melds, loose, wildRank }: { melds: DealResult["rows"][number]["melds"]; loose: Card[]; wildRank: number }) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {melds.map((m, i) => (
        <div key={i} className="shrink-0">
          <div className={clsx("mb-1 w-fit rounded px-1 text-[9px] font-bold uppercase ring-1", KIND_STYLE[m.kind])}>{MELD_LABEL[m.kind]}</div>
          <div className="flex">
            {m.cards.map((c, j) => (
              <PlayingCard key={c.id} card={c} size="sm" wild={isJoker(c, wildRank)} className={j ? "-ml-5" : ""} />
            ))}
          </div>
        </div>
      ))}
      {loose.length > 0 && (
        <div className="shrink-0">
          <div className={clsx("mb-1 w-fit rounded px-1 text-[9px] font-bold uppercase ring-1", KIND_STYLE.invalid)}>Ungrouped</div>
          <div className="flex">
            {loose.map((c, j) => (
              <PlayingCard key={c.id} card={c} size="sm" wild={isJoker(c, wildRank)} className={j ? "-ml-5" : ""} dimmed />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RummyTable({ view, meId, act, offset, deadline, turnStartedAt, advanceAt, online, reactions, busy, local }: TableCtx<RummyView>) {
  const seats = rotateToMe(view.players, meId);
  const me = seats[0]?.id === meId ? seats[0] : null;
  const others = me ? seats.slice(1) : seats;
  const positions = useSeatPositions(others.length);
  const myTurn = view.turnId === meId;
  const wide = useMediaQuery("(min-width: 640px)");
  const cardSize = wide ? "lg" : "md";

  const byId = useMemo(() => new Map(view.hand.map((c) => [c.id, c])), [view.hand]);
  const [groups, setGroups] = useGroups(view.hand, view.wildRank, `cc:rummy:${local ? "local" : "online"}:${meId}:${view.dealNo}`);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<"declare" | "drop" | null>(null);
  const dragId = useRef<string | null>(null);

  // Fit the whole hand on screen: overlap cards inside groups just enough.
  const handBox = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = handBox.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cw = useCardPx(wide ? 52 : 44, wide ? 14 : 11.5, wide ? 86 : 66);
  const groupGap = wide ? 16 : 8;

  useEffect(() => {
    setSelected((s) => new Set([...s].filter((id) => byId.has(id))));
  }, [byId]);

  // Sounds
  const lastLog = view.log[view.log.length - 1] ?? "";
  const prev = useRef(lastLog);
  useEffect(() => {
    if (prev.current === lastLog) return;
    prev.current = lastLog;
    if (/declares/.test(lastLog)) play("win");
    else if (/discards|picks up|draws/.test(lastLog)) play("card");
    else if (/Deal \d/.test(lastLog)) play("shuffle");
    else if (/drops|wrong/.test(lastLog)) play("error");
  }, [lastLog]);
  useEffect(() => {
    if (myTurn) {
      play("turn");
      buzz([20, 40, 20]);
    }
  }, [myTurn, view.turnId, view.deckCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const analysis = useMemo(() => {
    const info = groups.map((g) => {
      const cards = g.map((id) => byId.get(id)).filter(Boolean) as Card[];
      const kind = classifyMeld(cards, view.wildRank);
      const pts = cards.reduce((a, c) => a + cardPoints(c, view.wildRank), 0);
      return { kind, pts };
    });
    const hasPure = info.some((x) => x.kind === "pure");
    const seqs = info.filter((x) => x.kind === "pure" || x.kind === "impure").length;
    let points: number;
    if (hasPure && seqs >= 2) points = info.filter((x) => !x.kind).reduce((a, x) => a + x.pts, 0);
    else if (hasPure) points = info.filter((x) => x.kind !== "pure").reduce((a, x) => a + x.pts, 0);
    else points = info.reduce((a, x) => a + x.pts, 0);
    return { info, hasPure, seqs, points: Math.min(80, points) };
  }, [groups, byId, view.wildRank]);

  const toggle = (id: string) => {
    buzz(6);
    play("click");
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const moveTo = (target: number | "new", ids: string[], beforeId?: string) => {
    setGroups((gs) => {
      const moving = new Set(ids);
      const targetGroup = target === "new" ? null : gs[target];
      let next = gs.map((g) => g.filter((id) => !moving.has(id)));
      if (target === "new") next.push(sortGroup(ids, byId));
      else {
        const ti = gs.indexOf(targetGroup!);
        const g = next[ti];
        const at = beforeId ? g.indexOf(beforeId) : -1;
        next[ti] = at >= 0 ? [...g.slice(0, at), ...ids, ...g.slice(at)] : [...g, ...ids];
      }
      next = next.filter((g) => g.length);
      return next;
    });
    setSelected(new Set());
  };

  // Shrink cards a little if even a tight overlap can't fit every group on screen.
  const cardCount = groups.reduce((a, g) => a + g.length, 0);
  const avail = boxW - 8 - (groups.length - 1) * groupGap;
  const fitW = boxW ? avail / (groups.length + 0.34 * Math.max(0, cardCount - groups.length)) : cw;
  const cardW = Math.max(34, Math.min(cw, fitW));
  const step = boxW ? Math.max(cardW * 0.34, Math.min(cardW * 0.55, (avail - groups.length * cardW) / Math.max(1, cardCount - groups.length))) : cardW * 0.4;
  const overlap = step - cardW;

  const sel = [...selected];
  const one = sel.length === 1 ? sel[0] : null;
  const canDiscard = myTurn && view.phase === "discard" && !!one && one !== view.pickedFromDiscardId;

  const doDiscard = () => {
    if (!one) return;
    buzz(10);
    setSelected(new Set());
    void act({ type: "discard", cardId: one });
  };

  const draw = (from: "deck" | "discard") => {
    if (!myTurn || view.phase !== "draw" || busy) return;
    if (from === "discard" && !view.canTakeDiscard) return;
    buzz(10);
    void act({ type: "draw", from });
  };

  const nextIn = useSecondsLeft(view.phase === "dealover" ? advanceAt : null, offset);
  const discardFrom = view.topDiscardedBy && view.topDiscardedBy !== "pile" ? view.players.find((p) => p.id === view.topDiscardedBy) : null;
  const canDraw = myTurn && view.phase === "draw";

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <div className="felt-rummy felt-texture rail absolute inset-x-[5%] inset-y-[9%] rounded-[999px] sm:inset-x-[9%]" />

        {/* Center: wild, deck, open pile */}
        <div className="absolute left-1/2 top-[47%] z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <div className="flex items-end gap-2 sm:gap-5">
            <div className="flex flex-col items-center">
              <div className="relative">{view.wildCard && <PlayingCard card={view.wildCard} size="sm" className="rotate-[-8deg]" />}</div>
              <span className="mt-1.5 whitespace-nowrap rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-violet-200" title={`${rankName(view.wildRank, true)} are wild`}>
                Wild {rankLabel(view.wildRank)}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <button onClick={() => draw("deck")} disabled={!canDraw} className={clsx("relative rounded-[8px] transition", canDraw && "animate-pulse-ring hover:-translate-y-1")} aria-label="Draw from closed deck">
                <div className="absolute left-[3px] top-[3px] opacity-60">
                  <CardBack size="md" />
                </div>
                <CardBack size="md" />
              </button>
              <span className="mt-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-ink-200">{view.deckCount} left</span>
            </div>
            <div className="flex flex-col items-center">
              <button
                onClick={() => draw("discard")}
                disabled={!canDraw || !view.canTakeDiscard || !view.discardTop}
                className={clsx("relative rounded-[8px] transition", canDraw && view.canTakeDiscard && "animate-pulse-ring hover:-translate-y-1")}
                aria-label="Pick up from open pile"
                title={!view.canTakeDiscard ? "A discarded joker can't be picked up" : undefined}
              >
                <AnimatePresence mode="popLayout">
                  {view.discardTop ? (
                    <motion.div key={view.discardTop.id} initial={{ y: -30, opacity: 0, rotate: -10 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ opacity: 0 }}>
                      <PlayingCard card={view.discardTop} size="md" wild={isJoker(view.discardTop, view.wildRank)} />
                    </motion.div>
                  ) : (
                    <div className="rounded-[8px] border border-dashed border-white/20" style={{ width: "clamp(44px, 11.5vw, 66px)", height: "calc(clamp(44px, 11.5vw, 66px) * 1.4)" }} />
                  )}
                </AnimatePresence>
              </button>
              <span className="mt-1.5 max-w-[64px] truncate rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-ink-200 sm:max-w-[110px]">{discardFrom ? (discardFrom.id === meId ? "You" : discardFrom.name) : "Open"}</span>
            </div>
          </div>
          <div className="mt-3 h-6">
            <motion.span key={lastLog} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="block max-w-[72vw] truncate rounded-full bg-black/40 px-3 py-1 text-xs text-ink-100">
              {lastLog}
            </motion.span>
          </div>
        </div>

        {/* Opponents */}
        {others.map((p, i) => {
          const pos = positions[i];
          const statusPill =
            p.status === "dropped" ? (
              <StatusPill text="Dropped" tone="bad" />
            ) : p.status === "invalid" ? (
              <StatusPill text="Wrong show" tone="bad" />
            ) : p.status === "out" ? (
              <StatusPill text="Eliminated" tone="neutral" />
            ) : p.status === "declared" ? (
              <StatusPill text="Declared!" tone="good" />
            ) : null;
          return (
            <div key={p.id} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
              <Seat
                id={p.id}
                name={p.name}
                bot={p.isBot}
                active={view.turnId === p.id}
                deadline={deadline}
                startedAt={turnStartedAt}
                offset={offset}
                subtitle={view.poolLimit || view.totalDeals !== 1 ? `${p.total} pts` : `${p.cardCount} cards`}
                badge={p.isDealer ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-ink-950 shadow">D</span> : undefined}
                status={statusPill}
                dimmed={p.status !== "playing" && p.status !== "declared"}
                offline={!p.isBot && online[p.id] === false}
                reaction={reactions[p.id]}
                winner={view.result?.winnerId === p.id}
              />
            </div>
          );
        })}
      </div>

      {/* My hand */}
      {me && (
        <div className="relative z-30 border-t border-white/[0.06] bg-gradient-to-b from-ink-900/90 to-ink-950 px-2 pt-2 sm:px-6" style={{ paddingBottom: "calc(10px + var(--safe-bottom))" }}>
          <div className="mx-auto max-w-5xl">
            <div className="mb-1 flex items-center gap-2 px-1">
              <div className={clsx("relative rounded-full", myTurn && "ring-[3px] ring-gold-400 ring-offset-2 ring-offset-ink-900")}>
                <Avatar id={me.id} name={me.name} size={30} />
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
                  {me.status === "dropped"
                    ? "You dropped this deal"
                    : me.status === "invalid"
                      ? "Wrong declaration — out of this deal"
                      : me.status === "out"
                        ? "You're eliminated"
                        : myTurn
                          ? view.phase === "draw"
                            ? "Your turn — draw a card"
                            : "Select a card to discard, or declare"
                          : view.turnId
                            ? `${view.players.find((p) => p.id === view.turnId)?.name ?? "Someone"}'s turn`
                            : "Deal over"}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-400">
                  <span className={analysis.hasPure ? "text-emerald-300" : ""}>
                    {analysis.hasPure ? <Check className="mr-0.5 inline h-3 w-3" /> : <X className="mr-0.5 inline h-3 w-3" />}
                    Pure sequence
                  </span>
                  <span className={analysis.seqs >= 2 ? "text-emerald-300" : ""}>
                    {analysis.seqs >= 2 ? <Check className="mr-0.5 inline h-3 w-3" /> : <X className="mr-0.5 inline h-3 w-3" />}2 sequences
                  </span>
                  <span>
                    Points <b className="text-ink-200 tabular">{analysis.points}</b>
                  </span>
                  {(view.poolLimit || view.totalDeals !== 1) && (
                    <span>
                      Total <b className="text-ink-200 tabular">{me.total}</b>
                      {view.poolLimit ? ` / ${view.poolLimit}` : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {myTurn && <TimerBar deadline={deadline} startedAt={turnStartedAt} offset={offset} />}

            {/* Groups */}
            <div ref={handBox} className="no-scrollbar -mx-2 overflow-x-auto px-2">
              <div className="mx-auto flex w-max items-end pb-1 pt-4" style={{ gap: groupGap }}>
                {groups.map((g, gi) => {
                  const meta = analysis.info[gi];
                  const label = meta?.kind ? MELD_LABEL[meta.kind].replace("Pure sequence", "Pure") : g.length === 1 ? "" : `${meta?.pts ?? 0} pts`;
                  const canMoveHere = sel.length > 0 && !sel.every((id) => g.includes(id));
                  return (
                    <div
                      key={gi + ":" + g[0]}
                      className="flex flex-col items-center"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragId.current) moveTo(gi, [dragId.current]);
                        dragId.current = null;
                      }}
                    >
                      <div className="relative mb-1.5 h-5 w-full">
                        {label && (
                          <div className={clsx("absolute left-1/2 top-0 flex h-5 -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 text-[10px] font-bold ring-1", KIND_STYLE[meta?.kind ?? "invalid"])}>
                            {meta?.kind ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {label}
                          </div>
                        )}
                      </div>
                      <div className="flex">
                        {g.map((id, ci) => {
                          const c = byId.get(id);
                          if (!c) return null;
                          const isSel = selected.has(id);
                          return (
                            <motion.div layout key={id} transition={{ type: "spring", stiffness: 500, damping: 36 }} className="relative shrink-0" style={{ zIndex: ci, marginLeft: ci ? overlap : 0 }}>
                              <button
                                draggable
                                onDragStart={(e) => {
                                  dragId.current = id;
                                  e.dataTransfer.setData("text/plain", id);
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (dragId.current && dragId.current !== id) moveTo(gi, [dragId.current], id);
                                  dragId.current = null;
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onClick={() => toggle(id)}
                                className="block"
                                aria-pressed={isSel}
                              >
                                <PlayingCard card={c} size={cardSize} selected={isSel} wild={isJoker(c, view.wildRank)} style={{ ["--w" as string]: `${cardW}px` }} />
                              </button>
                              {id === view.lastDrawnId && myTurn && (
                                <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold-400 px-1.5 text-[9px] font-bold text-ink-950">NEW</span>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                      <div className="relative mt-1 h-7 w-full">
                        {canMoveHere && (
                          <button onClick={() => moveTo(gi, sel)} className="absolute left-1/2 top-0 flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-md bg-white/[0.1] px-2 py-1 text-[10px] font-semibold text-ink-100 hover:bg-white/15" aria-label="Move selected cards here">
                            <Plus className="h-3 w-3" /> Here
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Toolbar */}
            <div className="mt-1 flex items-center gap-2">
              <button className="btn-ghost h-10 px-3 text-xs" onClick={() => setGroups(sortBySuit(view.hand, view.wildRank))} title="Sort by suit">
                <Rows3 className="h-4 w-4" /> Sort
              </button>
              <button className="btn-secondary h-10 px-3 text-xs" disabled={sel.length < 2} onClick={() => moveTo("new", sel)}>
                <Layers className="h-4 w-4" /> Group
              </button>
              <div className="flex-1" />
              {myTurn && view.phase === "draw" && (
                <button className="btn-danger h-10 px-3 text-xs" onClick={() => setConfirm("drop")} disabled={busy}>
                  <CircleSlash className="h-4 w-4" /> Drop
                </button>
              )}
              {myTurn && view.phase === "discard" && (
                <>
                  <button className="btn-secondary h-10 px-3 text-xs" disabled={!one || busy} onClick={() => setConfirm("declare")}>
                    <Flag className="h-4 w-4" /> Declare
                  </button>
                  <button className="btn-primary h-10 px-4 text-xs" disabled={!canDiscard || busy} onClick={doDiscard}>
                    <ArrowDownToLine className="h-4 w-4" /> Discard
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmations */}
      <Modal open={confirm === "declare"} onClose={() => setConfirm(null)} title="Declare?">
        <div className="space-y-4 p-5 text-sm text-ink-200">
          <div className="flex items-center gap-4">
            {one && byId.get(one) && <PlayingCard card={byId.get(one)!} size="md" />}
            <p>
              This card goes to the finish slot. Your other 13 cards must form valid groups with at least two sequences, one of them pure.
              <span className="mt-2 block text-rose-300">A wrong declaration costs 80 points.</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary h-11" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn-primary h-11"
              onClick={() => {
                setConfirm(null);
                if (one) void act({ type: "declare", cardId: one });
                setSelected(new Set());
              }}
            >
              Declare
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={confirm === "drop"} onClose={() => setConfirm(null)} title="Drop this deal?">
        <div className="space-y-4 p-5 text-sm text-ink-200">
          <p>
            You&apos;ll sit out the rest of this deal and take <b className="text-gold-300">{view.dropCost} points</b>.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary h-11" onClick={() => setConfirm(null)}>
              Keep playing
            </button>
            <button
              className="btn-danger h-11"
              onClick={() => {
                setConfirm(null);
                void act({ type: "drop" });
              }}
            >
              Drop ({view.dropCost})
            </button>
          </div>
        </div>
      </Modal>

      {/* Deal result */}
      <Modal open={(view.phase === "dealover" || view.phase === "gameover") && !!view.result} title={`Deal ${view.dealNo} result`} wide>
        {view.result && (
          <div className="p-4 sm:p-5">
            <div className="space-y-2">
              {view.result.rows.map((r) => (
                <div key={r.id} className={clsx("rounded-2xl p-3", r.id === view.result!.winnerId ? "bg-gold-400/10 ring-1 ring-gold-400/30" : "bg-white/[0.04]")}>
                  <div className="mb-2 flex items-center gap-2.5">
                    <Avatar id={r.id} name={r.name} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {r.id === meId ? "You" : r.name}
                      {r.id === view.result!.winnerId && <span className="ml-2 text-xs text-gold-300">Winner</span>}
                      {r.note && r.id !== view.result!.winnerId && <span className="ml-2 text-xs font-medium text-ink-400">{r.note}</span>}
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold tabular">{r.points} pts</span>
                      {(view.poolLimit || view.totalDeals !== 1) && <span className="block text-[11px] text-ink-400 tabular">Total {r.total}</span>}
                    </span>
                  </div>
                  <MeldRow melds={r.melds} loose={r.loose} wildRank={view.wildRank} />
                </div>
              ))}
            </div>
            {view.phase === "dealover" && <p className="mt-4 text-center text-sm text-ink-400">Next deal in {nextIn ?? 0}s…</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
