export type GameId = "poker" | "rummy" | "uno";

export interface SeatInfo {
  id: string;
  name: string;
  isBot: boolean;
}

/** Thrown for illegal moves; the message is shown to the player. */
export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}

export interface BotInterrupt<A> {
  playerId: string;
  action: A;
  /** Identifies the situation so the scheduler doesn't fire twice for it. */
  key: string;
  delayMs: number;
}

/**
 * Every game is a pure state machine. `act` and `advance` mutate the state
 * object they are given; callers clone first when they need the old one.
 */
export interface Engine<S, A, V, Settings> {
  id: GameId;
  minPlayers: number;
  maxPlayers: number;
  defaultSettings: Settings;
  init(seats: SeatInfo[], settings: Settings): S;
  act(state: S, playerId: string, action: A): void;
  /** What `playerId` is allowed to see. `null` means a spectator. */
  view(state: S, playerId: string | null): V;
  /** Whose turn it is, or null while nobody needs to act. */
  actor(state: S): string | null;
  /** Changes whenever a new turn begins (even for the same player), so timers can reset. */
  turnKey(state: S): string | null;
  botAct(state: S, playerId: string): A;
  /** Actions taken for a human who ran out of time (applied in order). */
  timeoutActs(state: S, playerId: string): A[];
  /** Out-of-turn reactions bots may make (e.g. catching a missed UNO call). */
  interrupt?(state: S): BotInterrupt<A> | null;
  /** Milliseconds to wait before `advance` (e.g. after a hand ends), or null. */
  pendingAdvance(state: S): number | null;
  advance(state: S): void;
  isOver(state: S): boolean;
  /** A human left mid-game: let a bot play their seat. */
  setBot(state: S, playerId: string): void;
}
