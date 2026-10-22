import { GameError } from "@/games/types";
import { fail, json, readBody } from "@/lib/api";
import { createRoom, randomCode, RoomSettings } from "@/lib/room";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const store = getStore();
    let code = randomCode();
    for (let i = 0; i < 10 && (await store.exists(code)); i++) code = randomCode();
    if (await store.exists(code)) throw new GameError("Couldn't create a room — please try again");
    const now = Date.now();
    const { room, player } = createRoom(code, String(body.name ?? ""), (body.settings ?? {}) as Partial<RoomSettings>, now);
    await store.set(room);
    return json({ code, playerId: player.id, token: player.token });
  } catch (err) {
    return fail(err);
  }
}
