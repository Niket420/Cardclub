import { NextResponse } from "next/server";
import { GameError } from "@/games/types";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(err: unknown) {
  if (err instanceof GameError) return json({ error: err.message }, 400);
  const message = err instanceof Error ? err.message : "Something went wrong";
  console.error(err);
  return json({ error: message.includes("busy") ? message : "Something went wrong — please try again" }, 500);
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export const tokenOf = (req: Request) => req.headers.get("x-player-token");
