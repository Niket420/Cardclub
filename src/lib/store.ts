import { Redis } from "@upstash/redis";
import { Room } from "./room";

const ROOM_TTL_SECONDS = 60 * 60 * 12;
const LOCK_MS = 5000;

export interface Store {
  kind: "redis" | "memory";
  get(code: string): Promise<Room | null>;
  set(room: Room): Promise<void>;
  exists(code: string): Promise<boolean>;
  lock(code: string): Promise<boolean>;
  unlock(code: string): Promise<void>;
}

function redisStore(redis: Redis): Store {
  return {
    kind: "redis",
    async get(code) {
      return (await redis.get<Room>(`room:${code}`)) ?? null;
    },
    async set(room) {
      await redis.set(`room:${room.code}`, room, { ex: ROOM_TTL_SECONDS });
    },
    async exists(code) {
      return (await redis.exists(`room:${code}`)) > 0;
    },
    async lock(code) {
      return (await redis.set(`lock:${code}`, "1", { nx: true, px: LOCK_MS })) === "OK";
    },
    async unlock(code) {
      await redis.del(`lock:${code}`);
    },
  };
}

// Survives Next.js hot reloads in development.
const g = globalThis as unknown as { __rooms?: Map<string, { room: string; exp: number }>; __locks?: Map<string, number> };

function memoryStore(): Store {
  const rooms = (g.__rooms ??= new Map());
  const locks = (g.__locks ??= new Map());
  return {
    kind: "memory",
    async get(code) {
      const hit = rooms.get(code);
      if (!hit || hit.exp < Date.now()) return null;
      return JSON.parse(hit.room) as Room;
    },
    async set(room) {
      rooms.set(room.code, { room: JSON.stringify(room), exp: Date.now() + ROOM_TTL_SECONDS * 1000 });
    },
    async exists(code) {
      return rooms.has(code);
    },
    async lock(code) {
      const until = locks.get(code) ?? 0;
      if (until > Date.now()) return false;
      locks.set(code, Date.now() + LOCK_MS);
      return true;
    },
    async unlock(code) {
      locks.delete(code);
    },
  };
}

let cached: Store | null = null;

/** Upstash Redis when configured (Vercel KV / Upstash integration), otherwise in-process memory. */
export function getStore(): Store {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  cached = url && token ? redisStore(new Redis({ url, token })) : memoryStore();
  return cached;
}

export async function withLock<T>(code: string, fn: () => Promise<T>, waitMs = 4000): Promise<T> {
  const store = getStore();
  const start = Date.now();
  while (!(await store.lock(code))) {
    if (Date.now() - start > waitMs) throw new Error("The table is busy — please try again");
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 60));
  }
  try {
    return await fn();
  } finally {
    await store.unlock(code);
  }
}
