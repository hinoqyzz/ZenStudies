import { describe, expect, it } from "vitest";
import { focusElapsedMs, focusEndsAt, focusRemainingMs, formatRemaining, isFreshCompletion, normalizeFocus } from "./clock";
import type { FocusSession } from "../models";

function session(patch: Partial<FocusSession> = {}): FocusSession {
  return normalizeFocus({
    id: "foco",
    noteId: null,
    subjectId: null,
    title: "Sessão de foco",
    plannedMinutes: 25,
    startedAt: "2026-10-13T01:00:00.000Z",
    endedAt: null,
    status: "active",
    revision: 1,
    ...patch,
  });
}

describe("relógio de foco", () => {
  const now = new Date("2026-10-13T01:10:00.000Z");

  it("desconta o tempo já decorrido a partir do início", () => {
    const current = session();
    expect(focusElapsedMs(current, now)).toBe(10 * 60_000);
    expect(focusRemainingMs(current, now)).toBe(15 * 60_000);
    expect(focusEndsAt(current, now)?.toISOString()).toBe("2026-10-13T01:25:00.000Z");
  });

  it("congela a contagem enquanto a sessão está pausada", () => {
    const paused = session({
      status: "paused",
      pausedAt: "2026-10-13T01:04:00.000Z",
      pausedMs: 0,
    });
    expect(focusElapsedMs(paused, now)).toBe(4 * 60_000);
    expect(focusRemainingMs(paused, now)).toBe(21 * 60_000);
    expect(focusEndsAt(paused, now)).toBeNull();
  });

  it("ignora o intervalo em que a sessão ficou pausada", () => {
    const resumed = session({ pausedMs: 3 * 60_000 });
    expect(focusElapsedMs(resumed, now)).toBe(7 * 60_000);
    expect(focusRemainingMs(resumed, now)).toBe(18 * 60_000);
  });

  it("preenche pausa ausente em sessões antigas", () => {
    const legacy = normalizeFocus({
      id: "antiga",
      noteId: null,
      subjectId: null,
      title: "Antiga",
      plannedMinutes: 10,
      startedAt: "2026-10-13T01:00:00.000Z",
      endedAt: null,
      status: "active",
      revision: 1,
    });
    expect(legacy.pausedAt).toBeNull();
    expect(legacy.pausedMs).toBe(0);
    expect(focusRemainingMs(legacy, now)).toBe(0);
  });

  it("formata a contagem e reconhece uma conclusão recente", () => {
    expect(formatRemaining(65_100)).toBe("01:06");
    expect(formatRemaining(3_600_000)).toBe("1:00:00");
    const done = session({ status: "completed", endedAt: "2026-10-13T01:09:00.000Z" });
    expect(isFreshCompletion(done, now)).toBe(true);
    expect(isFreshCompletion(done, new Date("2026-10-13T02:00:00.000Z"))).toBe(false);
  });
});
