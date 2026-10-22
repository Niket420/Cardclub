/** localStorage wrappers that never throw (private mode, blocked storage, SSR). */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    if (value === undefined || value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export interface Seat {
  token: string;
  playerId: string;
}

export const seatKey = (code: string) => `cc:seat:${code}`;
export const NAME_KEY = "cc:name";
export const SOUND_KEY = "cc:sound";
export const LOCAL_ROOM_KEY = "cc:local-room";
