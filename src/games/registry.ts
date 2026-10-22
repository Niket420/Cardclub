import { pokerEngine } from "./poker/engine";
import { rummyEngine } from "./rummy/engine";
import { Engine, GameId } from "./types";
import { unoEngine } from "./uno/engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEngine = Engine<any, any, any, any>;

export const ENGINES: Record<GameId, AnyEngine> = {
  poker: pokerEngine,
  rummy: rummyEngine,
  uno: unoEngine,
};

export interface SettingOption {
  value: number | string | boolean;
  label: string;
  hint?: string;
}

export interface SettingField {
  key: string;
  label: string;
  options: SettingOption[];
}

export interface GameMeta {
  id: GameId;
  name: string;
  fullName: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  defaultSeats: number;
  duration: string;
  settings: SettingField[];
}

export const GAME_META: Record<GameId, GameMeta> = {
  poker: {
    id: "poker",
    name: "Poker",
    fullName: "Texas Hold'em",
    tagline: "No-limit Texas Hold'em. Bluff, bet and outlast the table.",
    minPlayers: 2,
    maxPlayers: 8,
    defaultSeats: 6,
    duration: "20–40 min",
    settings: [
      {
        key: "startingChips",
        label: "Starting chips",
        options: [
          { value: 1000, label: "1,000" },
          { value: 2000, label: "2,000" },
          { value: 5000, label: "5,000" },
        ],
      },
      {
        key: "bigBlind",
        label: "Blinds",
        options: [
          { value: 20, label: "10 / 20" },
          { value: 50, label: "25 / 50" },
          { value: 100, label: "50 / 100" },
        ],
      },
      {
        key: "blindLevelHands",
        label: "Blinds double",
        options: [
          { value: 0, label: "Never", hint: "Fixed blinds" },
          { value: 10, label: "10 hands", hint: "Standard" },
          { value: 5, label: "5 hands", hint: "Turbo" },
        ],
      },
    ],
  },
  rummy: {
    id: "rummy",
    name: "Rummy",
    fullName: "Indian Rummy · 13 cards",
    tagline: "Build sequences and sets, then declare before anyone else.",
    minPlayers: 2,
    maxPlayers: 6,
    defaultSeats: 4,
    duration: "5–30 min",
    settings: [
      {
        key: "mode",
        label: "Format",
        options: [
          { value: "points", label: "Points", hint: "One deal" },
          { value: "deals", label: "Deals", hint: "Best of 3 deals" },
          { value: "pool101", label: "Pool 101", hint: "Out at 101 points" },
          { value: "pool201", label: "Pool 201", hint: "Out at 201 points" },
        ],
      },
    ],
  },
  uno: {
    id: "uno",
    name: "UNO",
    fullName: "UNO",
    tagline: "Match colors and numbers. Don't forget to shout UNO!",
    minPlayers: 2,
    maxPlayers: 8,
    defaultSeats: 4,
    duration: "5–25 min",
    settings: [
      {
        key: "target",
        label: "Game length",
        options: [
          { value: 0, label: "One round" },
          { value: 200, label: "First to 200" },
          { value: 500, label: "First to 500", hint: "Official" },
        ],
      },
      {
        key: "stacking",
        label: "Stack +2 / +4",
        options: [
          { value: false, label: "Off", hint: "Official" },
          { value: true, label: "On", hint: "House rule" },
        ],
      },
    ],
  },
};

export const TURN_TIMER_OPTIONS: SettingOption[] = [
  { value: 0, label: "Off" },
  { value: 20, label: "20s" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
];

export const GAME_IDS: GameId[] = ["poker", "rummy", "uno"];

export function isGameId(x: unknown): x is GameId {
  return x === "poker" || x === "rummy" || x === "uno";
}

/** Keeps only known keys with allowed values; falls back to defaults. */
export function sanitizeGameSettings(gameId: GameId, input: unknown): Record<string, unknown> {
  const engine = ENGINES[gameId];
  const out: Record<string, unknown> = { ...engine.defaultSettings };
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  for (const field of GAME_META[gameId].settings) {
    if (field.options.some((o) => o.value === src[field.key])) out[field.key] = src[field.key];
  }
  return out;
}
