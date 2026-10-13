import { describe, expect, it } from "vitest";
import type { Card, ReviewSession } from "../models";
import { newCardSchedule } from "./scheduler";
import { answerCard } from "./session";
import { openStack } from "../../test/harness";

const now = new Date(2026, 9, 12, 15, 0, 0);

describe("sessão de revisão", () => {
  it("recoloca Ainda não uma vez e não duplica o evento", () => {
    const card = sampleCard();
    const session = sampleSession(card.id);
    const first = answerCard(session, card, "again", now, "evento-1");
    expect(first.session.cardIds).toEqual([card.id, card.id]);
    expect(first.session.responses).toHaveLength(1);
    expect(first.session.status).toBe("active");
    const second = answerCard(first.session, first.card, "again", new Date(now.getTime() + 1000), "evento-2");
    expect(second.session.cardIds).toEqual([card.id, card.id]);
    expect(second.session.status).toBe("completed");
    expect(second.event.previous.incorrectCount).toBe(1);
    expect(second.event.resulting.incorrectCount).toBe(2);
  });

  it("retoma a sessão gravada sem repetir respostas", async () => {
    const stack = await openStack();
    const note = await stack.services.notes.create({ title: "Revisão", text: "conteúdo" });
    await stack.services.cards.create({ noteId: note.id, question: "Pergunta", answer: "Resposta" });
    const started = await stack.services.review.startOrResume(now);
    if (!started) throw new Error("sessão ausente");
    expect(started.responses).toEqual([]);
    const again = await stack.services.review.startOrResume(now);
    expect(again?.id).toBe(started.id);
    await stack.services.review.answer(started.id, "again", now);
    const resumed = await stack.services.review.startOrResume(new Date(now.getTime() + 1000));
    expect(resumed?.id).toBe(started?.id);
    expect(resumed?.responses).toHaveLength(1);
    expect(await stack.services.review.events()).toHaveLength(1);
    stack.close();
  });
});

function sampleCard(): Card {
  return {
    id: "card-1",
    noteId: "note-1",
    subjectId: null,
    subjectName: "Sem matéria",
    question: "Pergunta",
    answer: "Resposta",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    deletedAt: null,
    revision: 1,
    origin: "user",
    sourcePdfId: null,
    sourcePage: null,
    sourceAnnotationId: null,
    ...newCardSchedule(now),
  };
}

function sampleSession(cardId: string): ReviewSession {
  return {
    id: "sessao-1",
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: null,
    cardIds: [cardId],
    position: 0,
    responses: [],
    status: "active",
  };
}
