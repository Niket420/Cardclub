import { fail, json, tokenOf } from "@/lib/api";
import { buildView, findByToken, normalizeCode, tick, tickDue, touch } from "@/lib/room";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const PRESENCE_REFRESH_MS = 5000;

/** Polling endpoint. Most polls are a single read; time-based steps (bots, timers) run here too. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = normalizeCode((await params).code);
    const since = Number(new URL(req.url).searchParams.get("v") ?? -1);
    const token = tokenOf(req);
    const store = getStore();
    let room = await store.get(code);
    if (!room) return json({ error: "Room not found. Check the code and try again." }, 404);

    const now = Date.now();
    const me = findByToken(room, token);
    if (tickDue(room, now) || (me && now - me.lastSeen > PRESENCE_REFRESH_MS)) {
      if (await store.lock(code)) {
        try {
          room = (await store.get(code)) ?? room;
          const meNow = findByToken(room, token);
          let changed = touch(room, meNow?.id ?? null, now);
          for (let i = 0; i < 3 && tick(room, now); i++) changed = true;
          if (changed) room.version++;
          await store.set(room);
        } finally {
          await store.unlock(code);
        }
      }
    }
    if (since === room.version) return json({ unchanged: true, serverNow: now });
    return json({ room: buildView(room, findByToken(room, token)?.id ?? null, now) });
  } catch (err) {
    return fail(err);
  }
}
