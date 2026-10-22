export interface TableCtx<V> {
  view: V;
  meId: string | null;
  act: (action: unknown) => Promise<boolean>;
  offset: number;
  deadline: number | null;
  turnStartedAt: number;
  advanceAt: number | null;
  online: Record<string, boolean>;
  reactions: Record<string, { id: string; emoji: string }>;
  local: boolean;
  busy: boolean;
  over: boolean;
}
