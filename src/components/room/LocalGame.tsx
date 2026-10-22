"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLocalRoom } from "@/lib/client/useRoom";
import { GameScreen } from "../game/GameScreen";
import { Loading } from "./RoomStates";

export function LocalGame() {
  const conn = useLocalRoom();
  const router = useRouter();

  useEffect(() => {
    if (conn.status === "notfound") router.replace("/");
  }, [conn.status, router]);

  if (conn.status !== "ready" || !conn.room?.game) return <Loading text="Shuffling the deck…" />;
  return (
    <GameScreen
      conn={conn}
      onExit={async (clear) => {
        if (clear) await conn.send({ type: "leave" });
        router.push("/");
      }}
    />
  );
}
