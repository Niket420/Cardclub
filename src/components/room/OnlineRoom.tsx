"use client";

import { useRouter } from "next/navigation";
import { useOnlineRoom } from "@/lib/client/useRoom";
import { GameScreen } from "../game/GameScreen";
import { Lobby } from "./Lobby";
import { JoinGate, Loading, Problem } from "./RoomStates";

export function OnlineRoom({ code }: { code: string }) {
  const conn = useOnlineRoom(code);
  const router = useRouter();

  const leave = async () => {
    await conn.send({ type: "leave" });
    router.push("/");
  };

  if (conn.status === "loading") return <Loading text={`Connecting to room ${code}…`} />;
  if (conn.status === "notfound") return <Problem title="Room not found" body={`There's no open room with code ${code}. Rooms close after 12 hours of inactivity — double-check the code with your host.`} />;
  if (conn.status === "kicked") return <Problem title="You're no longer in this room" body="The host removed you, or the room was reset. You can join again with the code." />;
  if (conn.status === "needjoin") return <JoinGate room={conn.room} code={code} onJoin={conn.join} busy={conn.busy} />;
  if (!conn.room) return <Loading text="Loading…" />;
  if (conn.room.status === "lobby" || !conn.room.game) return <Lobby conn={conn} onLeave={leave} />;
  return <GameScreen conn={conn} onExit={() => void leave()} />;
}
