import { describe, expect, it } from "vitest";
import { applyReview, isDueOnLocalDay, newCardSchedule } from "./scheduler";

const now = new Date(2026, 9, 12, 15, 0, 0);

describe("algoritmo de revisão", () => {
  it("começa o cartão novo com um dia e vencimento imediato", () => {
    const schedule = newCardSchedule(now);
    expect(schedule.currentInterval).toBe(1);
    expect(schedule.intervalUnit).toBe("days");
    expect(schedule.difficulty).toBe(2.5);
    expect(schedule.nextReviewAt).toBe(now.toISOString());
  });

  it("Ainda não conta erro e agenda dez minutos", () => {
    const next = applyReview(newCardSchedule(now), "again", now);
    expect(next.incorrectCount).toBe(1);
    expect(next.correctCount).toBe(0);
    expect(next.currentInterval).toBe(10);
    expect(next.intervalUnit).toBe("minutes");
    expect(new Date(next.nextReviewAt).getTime() - now.getTime()).toBe(10 * 60_000);
  });

  it("Quase começa em um dia e cresce com teto inteiro", () => {
    const first = applyReview(newCardSchedule(now), "hard", now);
    expect(first.currentInterval).toBe(1);
    expect(first.intervalUnit).toBe("days");
    expect(first.incorrectCount).toBe(0);
    const second = applyReview(first, "hard", new Date(now.getTime() + 86_400_000));
    expect(second.currentInterval).toBe(2);
  });

  it("Lembrei conta acerto e aumenta o intervalo", () => {
    const first = applyReview(newCardSchedule(now), "good", now);
    expect(first.correctCount).toBe(1);
    expect(first.currentInterval).toBe(1);
    const second = applyReview(first, "good", new Date(now.getTime() + 86_400_000));
    expect(second.currentInterval).toBe(3);
    const third = applyReview(second, "good", new Date(now.getTime() + 4 * 86_400_000));
    expect(third.currentInterval).toBe(7);
  });

  it("monta a fila só com cartões ativos vencidos no dia local", () => {
    expect(isDueOnLocalDay(now.toISOString(), now, "active", null)).toBe(true);
    expect(isDueOnLocalDay(new Date(2026, 9, 12, 23, 30).toISOString(), now, "active", null)).toBe(true);
    expect(isDueOnLocalDay(new Date(now.getTime() + 86_400_000).toISOString(), now, "active", null)).toBe(false);
    expect(isDueOnLocalDay(now.toISOString(), now, "suspended", null)).toBe(false);
    expect(isDueOnLocalDay(now.toISOString(), now, "archived", null)).toBe(false);
    expect(isDueOnLocalDay(now.toISOString(), now, "active", now.toISOString())).toBe(false);
  });
});
