import { GameError } from "@/games/types";
import { fail, json, readBody } from "@/lib/api";
import { buildView, joinRoom, normalizeCode, touch } from "@/lib/room";
import { getStore, withLock } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = normalizeCode((await params).code);
    const body = await readBody(req);
    const store = getStore();
    const result = await withLock(code, async () => {
      const room = await store.get(code);
      if (!room) throw new GameError("Room not found. Check the code and try again.");
      const now = Date.now();
      const player = joinRoom(room, String(body.name ?? ""), typeof body.token === "string" ? body.token : null, now);
      touch(room, player.id, now);
      room.version++;
      await store.set(room);
      return { playerId: player.id, token: player.token, room: buildView(room, player.id, now) };
    });
    return json(result);
  } catch (err) {
    return fail(err);
  }
}
