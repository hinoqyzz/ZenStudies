import type { CardState, IntervalUnit, ReviewResponse, ScheduleSnapshot } from "../models";

/**
 * Algoritmo determinístico do ZenStudies.
 * Um dia equivale a 86_400_000 ms. Não há aleatoriedade.
 *
 * Cartão novo: intervalo inicial de 1 dia e nextReviewAt = agora, para entrar na fila do dia.
 * Ainda não: +1 erro, intervalo de 10 minutos.
 * Quase: 1 dia na primeira vez; depois ceil(dias * 1.4), sempre em dias.
 * Lembrei: +1 acerto. Novo ou intervalo < 1 dia vira 1 dia; 1 dia vira 3 dias;
 * depois round(dias * 2.2), com teto de 180 dias.
 */
export const REVIEW_RULES = {
  againMinutes: 10,
  dayMs: 86_400_000,
  minuteMs: 60_000,
  hardGrowth: 1.4,
  goodGrowth: 2.2,
  goodSecondDays: 3,
  initialDays: 1,
  maxDays: 180,
  minDifficulty: 1,
  maxDifficulty: 5,
  defaultDifficulty: 2.5,
  againDifficultyStep: 0.35,
  hardDifficultyStep: 0.15,
  goodDifficultyStep: 0.25,
} as const;

export interface ScheduleInput {
  currentInterval: number;
  intervalUnit: IntervalUnit;
  difficulty: number;
  correctCount: number;
  incorrectCount: number;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  state: CardState;
}

export function newCardSchedule(now: Date): ScheduleInput {
  return {
    currentInterval: REVIEW_RULES.initialDays,
    intervalUnit: "days",
    difficulty: REVIEW_RULES.defaultDifficulty,
    correctCount: 0,
    incorrectCount: 0,
    nextReviewAt: now.toISOString(),
    lastReviewedAt: null,
    state: "active",
  };
}

export function applyReview(state: ScheduleInput, response: ReviewResponse, now: Date): ScheduleSnapshot {
  const reviewedAt = now.toISOString();
  if (response === "again") {
    return {
      currentInterval: REVIEW_RULES.againMinutes,
      intervalUnit: "minutes",
      difficulty: clampDifficulty(state.difficulty + REVIEW_RULES.againDifficultyStep),
      correctCount: state.correctCount,
      incorrectCount: state.incorrectCount + 1,
      nextReviewAt: new Date(now.getTime() + REVIEW_RULES.againMinutes * REVIEW_RULES.minuteMs).toISOString(),
      lastReviewedAt: reviewedAt,
      state: state.state,
    };
  }

  const days = intervalToDays(state.currentInterval, state.intervalUnit);
  const unseen = state.lastReviewedAt === null;
  if (response === "hard") {
    const nextDays = unseen || days < 1 ? REVIEW_RULES.initialDays : Math.max(1, Math.ceil(days * REVIEW_RULES.hardGrowth));
    return {
      currentInterval: nextDays,
      intervalUnit: "days",
      difficulty: clampDifficulty(state.difficulty + REVIEW_RULES.hardDifficultyStep),
      correctCount: state.correctCount,
      incorrectCount: state.incorrectCount,
      nextReviewAt: addDays(now, nextDays),
      lastReviewedAt: reviewedAt,
      state: state.state,
    };
  }

  let nextDays: number = REVIEW_RULES.initialDays;
  if (!unseen && days >= 1 && days < REVIEW_RULES.goodSecondDays) nextDays = REVIEW_RULES.goodSecondDays;
  else if (!unseen && days >= REVIEW_RULES.goodSecondDays) {
    nextDays = Math.min(REVIEW_RULES.maxDays, Math.round(days * REVIEW_RULES.goodGrowth));
  }
  return {
    currentInterval: nextDays,
    intervalUnit: "days",
    difficulty: clampDifficulty(state.difficulty - REVIEW_RULES.goodDifficultyStep),
    correctCount: state.correctCount + 1,
    incorrectCount: state.incorrectCount,
    nextReviewAt: addDays(now, nextDays),
    lastReviewedAt: reviewedAt,
    state: state.state,
  };
}

export function intervalToDays(value: number, unit: IntervalUnit): number {
  if (unit === "days") return value;
  if (unit === "hours") return value / 24;
  return value / (24 * 60);
}

export function endOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

export function isDueOnLocalDay(
  nextReviewAt: string,
  now: Date,
  state: CardState,
  deletedAt: string | null,
): boolean {
  if (deletedAt || state !== "active") return false;
  const due = new Date(nextReviewAt).getTime();
  if (Number.isNaN(due)) return false;
  return due <= endOfLocalDay(now).getTime();
}

export function snapshotFrom(state: ScheduleInput): ScheduleSnapshot {
  return {
    currentInterval: state.currentInterval,
    intervalUnit: state.intervalUnit,
    difficulty: state.difficulty,
    correctCount: state.correctCount,
    incorrectCount: state.incorrectCount,
    nextReviewAt: state.nextReviewAt,
    lastReviewedAt: state.lastReviewedAt,
    state: state.state,
  };
}

function addDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * REVIEW_RULES.dayMs).toISOString();
}

function clampDifficulty(value: number): number {
  return Math.min(REVIEW_RULES.maxDifficulty, Math.max(REVIEW_RULES.minDifficulty, Math.round(value * 100) / 100));
}
