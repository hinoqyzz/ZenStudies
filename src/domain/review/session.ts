import type { Card, ReviewEvent, ReviewResponse, ReviewSession } from "../models";
import { applyReview, snapshotFrom } from "./scheduler";

export interface AnswerResult {
  session: ReviewSession;
  card: Card;
  event: ReviewEvent;
}

export function answerCard(
  session: ReviewSession,
  card: Card,
  response: ReviewResponse,
  now: Date,
  eventId: string,
): AnswerResult {
  if (session.status !== "active") throw new Error("A sessão de revisão já foi concluída.");
  const expected = session.cardIds[session.position];
  if (expected !== card.id) throw new Error("O cartão não corresponde à posição atual da sessão.");
  const previous = snapshotFrom(card);
  const resulting = applyReview(card, response, now);
  const at = now.toISOString();
  const previousAgains = session.responses.filter((item) => item.cardId === card.id && item.response === "again").length;
  const cardIds = response === "again" && previousAgains === 0 ? [...session.cardIds, card.id] : session.cardIds;
  const position = session.position + 1;
  const completed = position >= cardIds.length;
  const nextSession: ReviewSession = {
    ...session,
    cardIds,
    position,
    responses: [...session.responses, { cardId: card.id, response, at, eventId }],
    updatedAt: at,
    status: completed ? "completed" : "active",
    completedAt: completed ? at : null,
  };
  const nextCard: Card = {
    ...card,
    ...resulting,
    updatedAt: at,
    revision: card.revision + 1,
  };
  const event: ReviewEvent = {
    id: eventId,
    cardId: card.id,
    sessionId: session.id,
    previous,
    response,
    resulting,
    reviewedAt: at,
  };
  return { session: nextSession, card: nextCard, event };
}

export function currentCardId(session: ReviewSession): string | null {
  if (session.status !== "active") return null;
  return session.cardIds[session.position] ?? null;
}
