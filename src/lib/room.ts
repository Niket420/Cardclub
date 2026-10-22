import { randomInt, shuffle } from "@/games/cards";
import { ENGINES, GAME_META, isGameId, sanitizeGameSettings, TURN_TIMER_OPTIONS } from "@/games/registry";
import { GameError, GameId, SeatInfo } from "@/games/types";

export interface RoomPlayer {
  id: string;
  name: string;
  token: string;
  joinedAt: number;
  lastSeen: number;
}

export interface RoomSettings {
  gameId: GameId;
  seats: number;
  /** Seconds per turn, 0 = no limit. */
  turnTimer: number;
  game: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  ts: number;
}

export interface Reaction {
  id: string;
  playerId: string;
  emoji: string;
  ts: number;
}

export interface GameRuntime {
  gameId: GameId;
  state: unknown;
  seats: SeatInfo[];
  turnKey: string | null;
  turnStartedAt: number;
  botDueAt: number | null;
  deadline: number | null;
  advanceAt: number | null;
  interrupt: { key: string; dueAt: number; playerId: string; action: unknown; done: boolean } | null;
  over: boolean;
  startedAt: number;
}

export interface Room {
  code: string;
  version: number;
  createdAt: number;
  hostId: string;
  settings: RoomSettings;
  players: RoomPlayer[];
  status: "lobby" | "playing";
  game: GameRuntime | null;
  chat: ChatMessage[];
  reactions: Reaction[];
  presence: string;
  /** Short-lived notice for everyone, e.g. "Ava left — a bot took over". */
  notices: { id: string; text: string; ts: number }[];
}

export type RoomAction =
  | { type: "start" }
  | { type: "settings"; settings: Partial<RoomSettings> }
  | { type: "kick"; playerId: string }
  | { type: "leave" }
  | { type: "chat"; text: string }
  | { type: "react"; emoji: string }
  | { type: "rematch" }
  | { type: "game"; action: unknown };

export interface RoomView {
  code: string;
  version: number;
  status: Room["status"];
  hostId: string;
  meId: string | null;
  settings: RoomSettings;
  players: { id: string; name: string; online: boolean }[];
  online: Record<string, boolean>;
  game: {
    gameId: GameId;
    view: unknown;
    deadline: number | null;
    turnStartedAt: number;
    advanceAt: number | null;
    over: boolean;
    bots: string[];
  } | null;
  chat: ChatMessage[];
  reactions: Reaction[];
  notices: Room["notices"];
  serverNow: number;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ONLINE_MS = 12_000;
const OFFLINE_AUTOPLAY_MS = 25_000;
export const REACTIONS = ["👍", "😂", "😮", "😎", "🔥", "😭", "🙏", "👏"];
const BOT_NAMES = ["Ava", "Leo", "Maya", "Kai", "Zara", "Rohan", "Isha", "Arjun", "Nora", "Felix", "Priya", "Omar", "Lena", "Dev", "Sana", "Theo"];

export function randomId(len = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[randomInt(chars.length)];
  return s;
}

export function randomCode(): string {
  let s = "";
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

export function cleanName(name: unknown): string {
  const n = String(name ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
  if (!n) throw new GameError("Please enter your name");
  return n;
}

export function sanitizeSettings(input: Partial<RoomSettings> | undefined, base?: RoomSettings): RoomSettings {
  const gameId = isGameId(input?.gameId) ? input!.gameId : base?.gameId ?? "uno";
  const meta = GAME_META[gameId];
  const rawSeats = Number(input?.seats ?? base?.seats ?? meta.defaultSeats);
  const seats = Math.max(meta.minPlayers, Math.min(meta.maxPlayers, Number.isFinite(rawSeats) ? Math.round(rawSeats) : meta.defaultSeats));
  const timer = input?.turnTimer ?? base?.turnTimer ?? 30;
  const turnTimer = TURN_TIMER_OPTIONS.some((o) => o.value === timer) ? (timer as number) : 30;
  const sameGame = base && base.gameId === gameId;
  const game = sanitizeGameSettings(gameId, { ...(sameGame ? base!.game : {}), ...(input?.game ?? {}) });
  return { gameId, seats, turnTimer, game };
}

export function createRoom(code: string, hostName: string, settings: Partial<RoomSettings>, now: number) {
  const host: RoomPlayer = { id: randomId(), name: cleanName(hostName), token: randomId(24), joinedAt: now, lastSeen: now };
  const room: Room = {
    code,
    version: 1,
    createdAt: now,
    hostId: host.id,
    settings: sanitizeSettings(settings),
    players: [host],
    status: "lobby",
    game: null,
    chat: [],
    reactions: [],
    presence: "",
    notices: [],
  };
  return { room, player: host };
}

export function findByToken(room: Room, token: string | null | undefined): RoomPlayer | null {
  if (!token) return null;
  return room.players.find((p) => p.token === token) ?? null;
}

function uniqueName(room: Room, name: string): string {
  const taken = new Set(room.players.map((p) => p.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const candidate = `${name.slice(0, 13)} ${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function joinRoom(room: Room, name: string, token: string | null, now: number): RoomPlayer {
  const existing = findByToken(room, token);
  if (existing) {
    existing.lastSeen = now;
    return existing;
  }
  if (room.status !== "lobby") throw new GameError("This game has already started");
  if (room.players.length >= room.settings.seats) throw new GameError("This room is full");
  const p: RoomPlayer = { id: randomId(), name: uniqueName(room, cleanName(name)), token: randomId(24), joinedAt: now, lastSeen: now };
  room.players.push(p);
  return p;
}

function notice(room: Room, text: string, now: number) {
  room.notices.push({ id: randomId(6), text, ts: now });
  room.notices = room.notices.filter((n) => now - n.ts < 10_000).slice(-5);
}

function startGame(room: Room, now: number) {
  const engine = ENGINES[room.settings.gameId];
  const humans: SeatInfo[] = room.players.map((p) => ({ id: p.id, name: p.name, isBot: false }));
  const botCount = Math.max(0, room.settings.seats - humans.length);
  const taken = new Set(humans.map((h) => h.name.toLowerCase()));
  const names = shuffle(BOT_NAMES.filter((n) => !taken.has(n.toLowerCase())));
  const bots: SeatInfo[] = Array.from({ length: botCount }, (_, i) => ({ id: `bot-${randomId(6)}`, name: names[i] ?? `Bot ${i + 1}`, isBot: true }));
  // Humans and bots are interleaved around the table so friends don't all sit together.
  const seats = shuffle([...humans, ...bots]);
  if (seats.length < engine.minPlayers) throw new GameError(`${GAME_META[engine.id].name} needs at least ${engine.minPlayers} players`);
  room.game = {
    gameId: engine.id,
    state: engine.init(seats, room.settings.game),
    seats,
    turnKey: null,
    turnStartedAt: now,
    botDueAt: null,
    deadline: null,
    advanceAt: null,
    interrupt: null,
    over: false,
    startedAt: now,
  };
  room.status = "playing";
  tick(room, now);
}

function botDelay(gameId: GameId): number {
  if (gameId === "poker") return 1100 + randomInt(1300);
  if (gameId === "rummy") return 1000 + randomInt(900);
  return 1200 + randomInt(800);
}

function applyGameAction(room: Room, playerId: string, action: unknown, now: number) {
  const rt = room.game;
  if (!rt || rt.over) throw new GameError("No game in progress");
  const engine = ENGINES[rt.gameId];
  const next = structuredClone(rt.state);
  engine.act(next, playerId, action);
  rt.state = next;
  syncTimers(room, now);
}

/** Recomputes turn timers / bot schedule after the game state changed. */
function syncTimers(room: Room, now: number) {
  const rt = room.game!;
  const engine = ENGINES[rt.gameId];
  if (engine.isOver(rt.state)) {
    rt.over = true;
    rt.deadline = rt.botDueAt = rt.advanceAt = null;
    rt.interrupt = null;
    rt.turnKey = null;
    return;
  }
  const actor = engine.actor(rt.state);
  const key = actor ? engine.turnKey(rt.state) : null;
  if (key !== rt.turnKey) {
    rt.turnKey = key;
    rt.turnStartedAt = now;
    const isBot = actor ? rt.seats.find((s) => s.id === actor)?.isBot : false;
    rt.botDueAt = actor && isBot ? now + botDelay(rt.gameId) : null;
    rt.deadline = actor && !isBot && room.settings.turnTimer > 0 ? now + room.settings.turnTimer * 1000 : null;
  }
  const adv = engine.pendingAdvance(rt.state);
  if (adv === null) rt.advanceAt = null;
  else if (rt.advanceAt === null) rt.advanceAt = now + adv;

  const intr = engine.interrupt?.(rt.state) ?? null;
  if (!intr) rt.interrupt = null;
  else if (rt.interrupt?.key !== intr.key) rt.interrupt = { key: intr.key, dueAt: now + intr.delayMs, playerId: intr.playerId, action: intr.action, done: false };
}

function humanOffline(room: Room, playerId: string, now: number) {
  const p = room.players.find((x) => x.id === playerId);
  return !p || now - p.lastSeen > ONLINE_MS;
}

/** True when something time-based should happen now. Cheap; used to skip locking on polls. */
export function tickDue(room: Room, now: number): boolean {
  const rt = room.game;
  if (!rt || rt.over) return false;
  if (rt.advanceAt !== null && now >= rt.advanceAt) return true;
  if (rt.interrupt && !rt.interrupt.done && now >= rt.interrupt.dueAt) return true;
  if (rt.botDueAt !== null && now >= rt.botDueAt) return true;
  if (rt.deadline !== null && now >= rt.deadline) return true;
  const actor = ENGINES[rt.gameId].actor(rt.state);
  if (actor && rt.botDueAt === null && humanOffline(room, actor, now) && now - rt.turnStartedAt > OFFLINE_AUTOPLAY_MS) return true;
  return false;
}

/** Runs at most one time-based step (bot move, timeout, auto-advance). Returns true if anything changed. */
export function tick(room: Room, now: number): boolean {
  const rt = room.game;
  if (!rt) return false;
  const before = JSON.stringify([rt.turnKey, rt.botDueAt, rt.deadline, rt.advanceAt, rt.interrupt?.key, rt.over]);
  syncTimers(room, now);
  let acted = false;
  const engine = ENGINES[rt.gameId];

  if (!rt.over) {
    if (rt.advanceAt !== null && now >= rt.advanceAt) {
      const next = structuredClone(rt.state);
      engine.advance(next);
      rt.state = next;
      rt.advanceAt = null;
      acted = true;
    } else if (rt.interrupt && !rt.interrupt.done && now >= rt.interrupt.dueAt) {
      rt.interrupt.done = true;
      try {
        applyGameAction(room, rt.interrupt.playerId, rt.interrupt.action, now);
      } catch {
        /* the moment passed */
      }
      acted = true;
    } else {
      const actor = engine.actor(rt.state);
      const seat = actor ? rt.seats.find((s) => s.id === actor) : null;
      if (actor && seat?.isBot && rt.botDueAt !== null && now >= rt.botDueAt) {
        const action = engine.botAct(rt.state, actor);
        try {
          applyGameAction(room, actor, action, now);
        } catch {
          // A bot should never make an illegal move, but never let one stall the table.
          for (const a of engine.timeoutActs(rt.state, actor)) {
            try {
              applyGameAction(room, actor, a, now);
            } catch {
              break;
            }
          }
        }
        // Same bot still to act (e.g. rummy draw → discard): give it a beat.
        if (rt.turnKey === engine.turnKey(rt.state) && engine.actor(rt.state) === actor) rt.botDueAt = now + 700 + randomInt(500);
        acted = true;
      } else if (
        actor &&
        !seat?.isBot &&
        ((rt.deadline !== null && now >= rt.deadline) ||
          (humanOffline(room, actor, now) && now - rt.turnStartedAt > OFFLINE_AUTOPLAY_MS))
      ) {
        for (const a of engine.timeoutActs(rt.state, actor)) {
          try {
            applyGameAction(room, actor, a, now);
          } catch {
            break;
          }
        }
        acted = true;
      }
    }
  }
  syncTimers(room, now);
  const after = JSON.stringify([rt.turnKey, rt.botDueAt, rt.deadline, rt.advanceAt, rt.interrupt?.key, rt.over]);
  return acted || before !== after;
}

/** Updates presence; returns true if anyone's online status flipped. */
export function touch(room: Room, playerId: string | null, now: number): boolean {
  const p = playerId ? room.players.find((x) => x.id === playerId) : null;
  if (p) p.lastSeen = now;
  const sig = room.players.map((x) => (now - x.lastSeen < ONLINE_MS ? "1" : "0")).join("");
  if (sig !== room.presence) {
    room.presence = sig;
    return true;
  }
  return false;
}

export function applyRoomAction(room: Room, playerId: string, action: RoomAction, now: number) {
  const me = room.players.find((p) => p.id === playerId);
  if (!me) throw new GameError("You're not in this room");
  const isHost = room.hostId === playerId;

  switch (action.type) {
    case "start":
      if (!isHost) throw new GameError("Only the host can start the game");
      if (room.status !== "lobby") throw new GameError("The game has already started");
      startGame(room, now);
      return;
    case "settings": {
      if (!isHost) throw new GameError("Only the host can change settings");
      if (room.status !== "lobby") throw new GameError("Settings are locked during a game");
      const next = sanitizeSettings(action.settings, room.settings);
      if (next.seats < room.players.length) next.seats = Math.min(GAME_META[next.gameId].maxPlayers, room.players.length);
      if (room.players.length > GAME_META[next.gameId].maxPlayers)
        throw new GameError(`${GAME_META[next.gameId].name} allows at most ${GAME_META[next.gameId].maxPlayers} players`);
      room.settings = next;
      return;
    }
    case "kick": {
      if (!isHost) throw new GameError("Only the host can remove players");
      if (room.status !== "lobby") throw new GameError("You can't remove players mid-game");
      if (action.playerId === playerId) throw new GameError("You can't remove yourself");
      const target = room.players.find((p) => p.id === action.playerId);
      if (!target) return;
      room.players = room.players.filter((p) => p !== target);
      notice(room, `${target.name} was removed by the host`, now);
      return;
    }
    case "leave": {
      room.players = room.players.filter((p) => p !== me);
      if (room.game && !room.game.over) {
        const seat = room.game.seats.find((s) => s.id === me.id);
        if (seat) {
          seat.isBot = true;
          ENGINES[room.game.gameId].setBot(room.game.state, me.id);
          room.game.turnKey = null; // reschedule as a bot turn if it was theirs
          syncTimers(room, now);
        }
        notice(room, `${me.name} left — a computer player took over`, now);
      } else notice(room, `${me.name} left the room`, now);
      if (room.hostId === me.id && room.players.length) {
        room.hostId = room.players[0].id;
        notice(room, `${room.players[0].name} is now the host`, now);
      }
      return;
    }
    case "chat": {
      const text = String(action.text ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (!text) return;
      room.chat.push({ id: randomId(8), playerId, name: me.name, text, ts: now });
      if (room.chat.length > 60) room.chat.splice(0, room.chat.length - 60);
      return;
    }
    case "react": {
      if (!REACTIONS.includes(action.emoji)) throw new GameError("Unknown reaction");
      room.reactions = room.reactions.filter((r) => now - r.ts < 6000 && r.playerId !== playerId);
      room.reactions.push({ id: randomId(6), playerId, emoji: action.emoji, ts: now });
      return;
    }
    case "rematch": {
      if (!isHost) throw new GameError("Only the host can start a new game");
      if (room.status !== "playing" || !room.game?.over) throw new GameError("The current game isn't finished yet");
      room.status = "lobby";
      room.game = null;
      if (room.settings.seats < room.players.length) room.settings.seats = room.players.length;
      return;
    }
    case "game": {
      if (room.status !== "playing") throw new GameError("The game hasn't started");
      applyGameAction(room, playerId, action.action, now);
      return;
    }
    default:
      throw new GameError("Unknown action");
  }
}

export function buildView(room: Room, playerId: string | null, now: number): RoomView {
  const rt = room.game;
  const online: Record<string, boolean> = {};
  for (const p of room.players) online[p.id] = now - p.lastSeen < ONLINE_MS;
  return {
    code: room.code,
    version: room.version,
    status: room.status,
    hostId: room.hostId,
    meId: playerId,
    settings: room.settings,
    players: room.players.map((p) => ({ id: p.id, name: p.name, online: online[p.id] })),
    online,
    game: rt
      ? {
          gameId: rt.gameId,
          view: ENGINES[rt.gameId].view(rt.state, playerId),
          deadline: rt.deadline,
          turnStartedAt: rt.turnStartedAt,
          advanceAt: rt.advanceAt,
          over: rt.over,
          bots: rt.seats.filter((s) => s.isBot).map((s) => s.id),
        }
      : null,
    chat: room.chat.slice(-40),
    reactions: room.reactions.filter((r) => now - r.ts < 6000),
    notices: room.notices.filter((n) => now - n.ts < 10_000),
    serverNow: now,
  };
}
