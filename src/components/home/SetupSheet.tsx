"use client";

import { Minus, Plus, Timer, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GAME_META, sanitizeGameSettings, TURN_TIMER_OPTIONS } from "@/games/registry";
import { GameId } from "@/games/types";
import { load, NAME_KEY, save } from "@/lib/client/storage";
import { createLocalRoom, createOnlineRoom } from "@/lib/client/useRoom";
import { Modal } from "../ui/Modal";
import { Segmented } from "../ui/Segmented";
import { toast } from "../ui/Toaster";
import { GameArt } from "./GameArt";

export type SetupMode = "friends" | "computer";

export function SeatStepper({ value, min, max, onChange, humans }: { value: number; min: number; max: number; onChange: (n: number) => void; humans?: number }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" className="btn-secondary h-11 w-11 p-0" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Fewer players">
        <Minus className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <div className="font-display text-2xl font-bold tabular leading-none">{value}</div>
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {Array.from({ length: max }, (_, i) => (
            <span key={i} className={`h-1.5 w-4 rounded-full transition-colors ${i < (humans ?? 0) ? "bg-emerald-400" : i < value ? "bg-gold-400" : "bg-white/10"}`} />
          ))}
        </div>
      </div>
      <button type="button" className="btn-secondary h-11 w-11 p-0" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="More players">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function GameSettingsFields({ game, values, onChange, disabled }: { game: GameId; values: Record<string, unknown>; onChange?: (key: string, v: unknown) => void; disabled?: boolean }) {
  return (
    <>
      {GAME_META[game].settings.map((f) => (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          <Segmented
            options={f.options.map((o) => ({ value: o.value, label: o.label, hint: o.hint }))}
            value={values[f.key] as string | number | boolean}
            onChange={(v) => onChange?.(f.key, v)}
            disabled={disabled}
            size="sm"
          />
        </div>
      ))}
    </>
  );
}

export function SetupSheet({ game, mode: initialMode, onClose }: { game: GameId | null; mode: SetupMode; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<SetupMode>(initialMode);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(4);
  const [timer, setTimer] = useState(30);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!game) return;
    setMode(initialMode);
    setName(load(NAME_KEY, ""));
    setSeats(GAME_META[game].defaultSeats);
    setSettings(sanitizeGameSettings(game, load(`cc:settings:${game}`, {})));
  }, [game, initialMode]);

  if (!game) return <Modal open={false}>{null}</Modal>;
  const meta = GAME_META[game];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      toast("Please enter your name", "error");
      return;
    }
    save(NAME_KEY, n);
    save(`cc:settings:${game}`, settings);
    setBusy(true);
    try {
      if (mode === "computer") {
        createLocalRoom(n, { gameId: game, seats, game: settings });
        router.push("/play");
      } else {
        const code = await createOnlineRoom(n, { gameId: game, seats, turnTimer: timer, game: settings });
        router.push(`/room/${code}`);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!game}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span>{meta.name}</span>
          <span className="chip bg-white/[0.06] text-ink-300">{meta.fullName === meta.name ? `${meta.minPlayers}–${meta.maxPlayers} players` : meta.fullName}</span>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-5 px-5 py-5">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-felt-700/50 to-felt-900/40 px-5 py-4">
          <p className="max-w-[60%] text-sm text-ink-200">{meta.tagline}</p>
          <div className="pr-4 pt-2">
            <GameArt game={game} />
          </div>
        </div>

        <Segmented<SetupMode>
          options={[
            { value: "friends", label: "Play with friends", hint: "Online room with a code" },
            { value: "computer", label: "Play vs computer", hint: "Offline · starts instantly" },
          ]}
          value={mode}
          onChange={setMode}
        />

        <div>
          <label className="label" htmlFor="setup-name">
            Your name
          </label>
          <input id="setup-name" className="input" placeholder="e.g. Priya" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Players at the table
          </label>
          <SeatStepper value={seats} min={meta.minPlayers} max={meta.maxPlayers} onChange={setSeats} humans={1} />
          <p className="mt-2 text-center text-xs text-ink-400">
            {mode === "computer"
              ? `You and ${seats - 1} computer player${seats - 1 === 1 ? "" : "s"}`
              : "Friends join with a code. Any empty seats are filled by computer players when you start."}
          </p>
        </div>

        <GameSettingsFields game={game} values={settings} onChange={(k, v) => setSettings((s) => ({ ...s, [k]: v }))} />

        {mode === "friends" && (
          <div>
            <label className="label flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" /> Turn timer
            </label>
            <Segmented options={TURN_TIMER_OPTIONS.map((o) => ({ value: o.value as number, label: o.label }))} value={timer} onChange={setTimer} size="sm" />
          </div>
        )}

        <div className="sticky bottom-0 -mx-5 -mb-5 bg-gradient-to-t from-ink-850 via-ink-850 to-ink-850/0 px-5 pb-5 pt-3">
          <button type="submit" className="btn-primary h-12 w-full text-base" disabled={busy}>
            {busy ? "Setting up the table…" : mode === "computer" ? "Start game" : "Create room"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
