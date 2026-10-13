import type { FocusSession } from "../models";

const MINUTE = 60_000;
export const FOCUS_PRESETS = [15, 25, 45, 60] as const;
export const FOCUS_DONE_WINDOW_MS = 30 * MINUTE;

type StoredFocus = Omit<FocusSession, "pausedAt" | "pausedMs"> & {
  pausedAt?: string | null;
  pausedMs?: number;
};

export function clampFocusMinutes(value: number): number {
  if (!Number.isFinite(value)) return 25;
  return Math.min(180, Math.max(1, Math.round(value)));
}

export function normalizeFocus(session: StoredFocus): FocusSession {
  const pausedMs = Number.isFinite(session.pausedMs) ? Math.max(0, Number(session.pausedMs)) : 0;
  return {
    ...session,
    pausedAt: session.pausedAt || null,
    pausedMs,
  };
}

export function focusElapsedMs(session: FocusSession, now: Date): number {
  const start = new Date(session.startedAt).getTime();
  const pausedMs = session.pausedMs;
  let end = now.getTime();
  if (session.status === "paused" && session.pausedAt) end = new Date(session.pausedAt).getTime();
  if ((session.status === "completed" || session.status === "cancelled") && session.endedAt) end = new Date(session.endedAt).getTime();
  return Math.max(0, end - start - pausedMs);
}

export function focusRemainingMs(session: FocusSession, now: Date): number {
  return Math.max(0, session.plannedMinutes * MINUTE - focusElapsedMs(session, now));
}

export function focusEndsAt(session: FocusSession, now: Date): Date | null {
  if (session.status !== "active") return null;
  const remaining = focusRemainingMs(session, now);
  if (remaining <= 0) return now;
  return new Date(now.getTime() + remaining);
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
}

export function isFreshCompletion(session: FocusSession, now: Date, withinMs = FOCUS_DONE_WINDOW_MS): boolean {
  if (session.status !== "completed" || !session.endedAt) return false;
  return now.getTime() - new Date(session.endedAt).getTime() <= withinMs;
}
