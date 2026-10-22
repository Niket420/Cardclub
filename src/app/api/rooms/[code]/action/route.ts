import { GameError } from "@/games/types";
import { fail, json, readBody, tokenOf } from "@/lib/api";
import { applyRoomAction, buildView, findByToken, normalizeCode, RoomAction, tick, touch } from "@/lib/room";
import { getStore, withLock } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = normalizeCode((await params).code);
    const body = await readBody(req);
    const action = body.action as RoomAction | undefined;
    if (!action || typeof action !== "object" || typeof action.type !== "string") throw new GameError("Invalid request");
    const token = tokenOf(req);
    const store = getStore();
    const result = await withLock(code, async () => {
      const room = await store.get(code);
      if (!room) throw new GameError("This room has expired");
      const me = findByToken(room, token);
      if (!me) throw new GameError("You're no longer in this room");
      const now = Date.now();
      // Catch up on anything that was due before applying the player's move.
      for (let i = 0; i < 3 && tick(room, now); i++);
      applyRoomAction(room, me.id, action, now);
      tick(room, now);
      touch(room, action.type === "leave" ? null : me.id, now);
      room.version++;
      await store.set(room);
      return action.type === "leave" ? { left: true } : { room: buildView(room, me.id, now) };
    });
    return json(result);
  } catch (err) {
    return fail(err);
  }
}
