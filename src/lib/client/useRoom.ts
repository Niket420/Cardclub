"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/Toaster";
import { GameError } from "@/games/types";
import { applyRoomAction, buildView, createRoom, Room, RoomAction, RoomSettings, RoomView, tick, touch } from "@/lib/room";
import { play } from "./sound";
import { load, LOCAL_ROOM_KEY, save, Seat, seatKey } from "./storage";

export type ConnStatus = "loading" | "ready" | "needjoin" | "notfound" | "kicked";

export interface RoomConn {
  mode: "online" | "local";
  room: RoomView | null;
  status: ConnStatus;
  /** Network trouble while polling. */
  reconnecting: boolean;
  /** serverNow − Date.now(), to render server deadlines on this device's clock. */
  offset: number;
  busy: boolean;
  send: (action: RoomAction) => Promise<boolean>;
}

async function api<T>(url: string, init?: RequestInit & { token?: string | null }): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.token) headers["x-player-token"] = init.token;
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  const data = await res.json().catch(() => ({ error: "Unexpected response from server" }));
  return { ok: res.ok, status: res.status, data };
}

export async function createOnlineRoom(name: string, settings: Partial<RoomSettings>): Promise<string> {
  const r = await api<{ code: string; playerId: string; token: string }>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ name, settings }),
  });
  if (!r.ok) throw new Error(r.data.error ?? "Couldn't create the room");
  save(seatKey(r.data.code), { token: r.data.token, playerId: r.data.playerId } satisfies Seat);
  return r.data.code;
}

export function useOnlineRoom(code: string): RoomConn & { join: (name: string) => Promise<boolean> } {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<ConnStatus>("loading");
  const [reconnecting, setReconnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const seat = useRef<Seat | null>(null);
  const version = useRef(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);
  const alive = useRef(true);
  const roomRef = useRef<RoomView | null>(null);

  const accept = useCallback(
    (view: RoomView, sentAt: number) => {
      setOffset(view.serverNow - (sentAt + Date.now()) / 2);
      version.current = view.version;
      roomRef.current = view;
      setRoom(view);
      if (seat.current && !view.meId) {
        // Our seat vanished: removed by the host or the room was recycled.
        save(seatKey(code), null);
        seat.current = null;
        setStatus("kicked");
      } else setStatus(view.meId ? "ready" : "needjoin");
    },
    [code],
  );

  const poll = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const sentAt = Date.now();
    try {
      const r = await api<{ room?: RoomView; unchanged?: boolean; serverNow?: number }>(`/api/rooms/${code}?v=${version.current}`, {
        token: seat.current?.token,
      });
      if (!alive.current) return;
      if (r.status === 404) {
        setStatus("notfound");
        return;
      }
      if (r.ok) {
        failures.current = 0;
        setReconnecting(false);
        if (r.data.room) accept(r.data.room, sentAt);
        else if (r.data.serverNow) setOffset(r.data.serverNow - (sentAt + Date.now()) / 2);
      } else throw new Error(r.data.error);
    } catch {
      failures.current++;
      if (failures.current >= 3) setReconnecting(true);
    }
    if (!alive.current) return;
    const hidden = typeof document !== "undefined" && document.hidden;
    const lobby = roomRef.current?.status === "lobby";
    const delay = failures.current ? Math.min(5000, 800 * failures.current) : hidden ? 4000 : lobby ? 1500 : 900;
    timer.current = setTimeout(poll, delay);
  }, [code, accept]);

  useEffect(() => {
    alive.current = true;
    seat.current = load<Seat | null>(seatKey(code), null);
    void poll();
    const onVis = () => !document.hidden && void poll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [code, poll]);

  const join = useCallback(
    async (name: string) => {
      setBusy(true);
      const sentAt = Date.now();
      try {
        const r = await api<{ playerId: string; token: string; room: RoomView }>(`/api/rooms/${code}/join`, {
          method: "POST",
          body: JSON.stringify({ name, token: seat.current?.token }),
        });
        if (!r.ok) {
          toast(r.data.error ?? "Couldn't join", "error");
          return false;
        }
        seat.current = { token: r.data.token, playerId: r.data.playerId };
        save(seatKey(code), seat.current);
        accept(r.data.room, sentAt);
        return true;
      } catch {
        toast("Network error — check your connection", "error");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [code, accept],
  );

  const send = useCallback(
    async (action: RoomAction) => {
      setBusy(true);
      const sentAt = Date.now();
      try {
        const r = await api<{ room?: RoomView; left?: boolean }>(`/api/rooms/${code}/action`, {
          method: "POST",
          token: seat.current?.token,
          body: JSON.stringify({ action }),
        });
        if (!r.ok) {
          play("error");
          toast(r.data.error ?? "That didn't work", "error");
          void poll();
          return false;
        }
        if (r.data.left) {
          save(seatKey(code), null);
          seat.current = null;
          return true;
        }
        if (r.data.room) accept(r.data.room, sentAt);
        return true;
      } catch {
        toast("Network error — check your connection", "error");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [code, accept, poll],
  );

  return { mode: "online", room, status, reconnecting, offset, busy, send, join };
}

// ---------- Offline games against the computer ----------

export function createLocalRoom(name: string, settings: Partial<RoomSettings>) {
  const now = Date.now();
  const { room, player } = createRoom("LOCAL", name, { ...settings, turnTimer: 0 }, now);
  applyRoomAction(room, player.id, { type: "start" }, now);
  save(LOCAL_ROOM_KEY, room);
}

export function useLocalRoom(): RoomConn {
  const ref = useRef<Room | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<ConnStatus>("loading");
  const lastSave = useRef(0);

  const publish = useCallback((force = false) => {
    const r = ref.current;
    if (!r) return;
    const now = Date.now();
    setRoom(buildView(r, r.players[0]?.id ?? null, now));
    if (force || now - lastSave.current > 1500) {
      lastSave.current = now;
      save(LOCAL_ROOM_KEY, r);
    }
  }, []);

  useEffect(() => {
    const stored = load<Room | null>(LOCAL_ROOM_KEY, null);
    if (!stored || !stored.players.length) {
      setStatus("notfound");
      return;
    }
    const now = Date.now();
    // Resuming after a reload: restart any pending timers from now.
    if (stored.game) {
      stored.game.turnKey = null;
      stored.game.advanceAt = null;
      stored.game.interrupt = null;
    }
    ref.current = stored;
    touch(stored, stored.players[0].id, now);
    tick(stored, now);
    setStatus("ready");
    publish(true);
    const id = setInterval(() => {
      const r = ref.current;
      if (!r) return;
      const t = Date.now();
      touch(r, r.players[0].id, t);
      if (tick(r, t)) {
        r.version++;
        publish();
      }
    }, 150);
    const persist = () => ref.current && save(LOCAL_ROOM_KEY, ref.current);
    window.addEventListener("pagehide", persist);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, [publish]);

  const send = useCallback(
    async (action: RoomAction) => {
      const r = ref.current;
      if (!r) return false;
      const now = Date.now();
      try {
        if (action.type === "leave") {
          save(LOCAL_ROOM_KEY, null);
          ref.current = null;
          return true;
        }
        applyRoomAction(r, r.players[0].id, action, now);
        if (action.type === "rematch") applyRoomAction(r, r.players[0].id, { type: "start" }, now);
        tick(r, now);
        r.version++;
        publish(true);
        return true;
      } catch (err) {
        play("error");
        toast(err instanceof GameError ? err.message : "That didn't work", "error");
        return false;
      }
    },
    [publish],
  );

  return { mode: "local", room, status, reconnecting: false, offset: 0, busy: false, send };
}
