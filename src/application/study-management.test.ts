import { afterEach, describe, expect, it } from "vitest";
import type { FocusSession } from "../domain/models";
import { loadPreferences, savePreferences } from "../domain/preferences";
import { pdfBytes, openStack } from "../test/harness";

const originalPreferences = loadPreferences();

afterEach(() => {
  savePreferences(originalPreferences);
});

describe("foco, cartões e matérias", () => {
  it("não duplica a sessão e congela o tempo na pausa", async () => {
    const stack = await openStack();
    const first = await stack.services.focus.start({ minutes: 25 });
    const second = await stack.services.focus.start({ minutes: 5 });
    expect(second.id).toBe(first.id);
    expect(second.plannedMinutes).toBe(25);

    const paused = await stack.services.focus.pause(first.id);
    await stack.repository.putFocus({ ...paused, pausedAt: new Date(Date.now() - 5_000).toISOString() });
    const resumed = await stack.services.focus.resume(first.id);
    expect(resumed.status).toBe("active");
    expect(resumed.pausedMs).toBeGreaterThanOrEqual(4_000);
    expect(resumed.pausedAt).toBeNull();

    const restarted = await stack.services.focus.restart(first.id);
    expect(restarted.id).toBe(first.id);
    expect(restarted.pausedMs).toBe(0);
    expect(restarted.status).toBe("active");
    stack.close();
  });

  it("conclui uma vez e notifica só quando o tempo acaba", async () => {
    const stack = await openStack();
    stack.desktop.permission = "granted";
    savePreferences({ ...loadPreferences(), notificationsEnabled: true, notifyFocusEnd: true });
    const session = await stack.services.focus.start({ minutes: 10 });
    const manual = await stack.services.focus.finish(session.id, { notify: false });
    expect(manual.changed).toBe(true);
    expect(manual.session.status).toBe("completed");
    const repeated = await stack.services.focus.finish(session.id, { notify: true });
    expect(repeated.changed).toBe(false);
    expect(stack.desktop.notifications).toHaveLength(0);

    const next = await stack.services.focus.restart(session.id);
    await stack.services.focus.finish(next.id, { notify: true });
    await stack.services.focus.finish(next.id, { notify: true });
    expect(stack.desktop.notifications).toHaveLength(1);
    stack.close();
  });

  it("lê uma sessão antiga sem campos de pausa", async () => {
    const stack = await openStack();
    await stack.database.focusSessions.put({
      id: "antiga",
      noteId: null,
      subjectId: null,
      title: "Antiga",
      plannedMinutes: 25,
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: "active",
      revision: 1,
    } as FocusSession);
    const current = await stack.services.focus.current();
    expect(current?.id).toBe("antiga");
    expect(current?.pausedMs).toBe(0);
    expect(current?.pausedAt).toBeNull();
    stack.close();
  });

  it("edita o cartão sem perder o histórico e respeita suspensão", async () => {
    const stack = await openStack();
    const note = await stack.services.notes.create({ title: "Célula", text: "ATP" });
    const card = await stack.services.cards.create({ noteId: note.id, question: "O que produz ATP?", answer: "Mitocôndria" });
    await stack.repository.putCard({ ...card, correctCount: 3, incorrectCount: 1 });
    await stack.repository.putEvent({
      id: "evento-1",
      cardId: card.id,
      sessionId: "sessao",
      previous: {
        currentInterval: card.currentInterval,
        intervalUnit: card.intervalUnit,
        difficulty: card.difficulty,
        correctCount: 2,
        incorrectCount: 1,
        nextReviewAt: card.nextReviewAt,
        lastReviewedAt: null,
        state: "active",
      },
      response: "good",
      resulting: {
        currentInterval: card.currentInterval,
        intervalUnit: card.intervalUnit,
        difficulty: card.difficulty,
        correctCount: 3,
        incorrectCount: 1,
        nextReviewAt: card.nextReviewAt,
        lastReviewedAt: card.updatedAt,
        state: "active",
      },
      reviewedAt: card.updatedAt,
    });

    const updated = await stack.services.cards.update(card.id, { question: "Quem produz ATP?", answer: "A mitocôndria" });
    expect(updated.question).toBe("Quem produz ATP?");
    expect(updated.correctCount).toBe(3);
    expect(updated.incorrectCount).toBe(1);
    expect(updated.nextReviewAt).toBe(card.nextReviewAt);

    await stack.services.cards.setState(card.id, "suspended");
    expect(await stack.services.cards.due()).toHaveLength(0);
    await stack.services.cards.setState(card.id, "archived");
    expect(await stack.services.cards.due()).toHaveLength(0);
    await stack.services.cards.setState(card.id, "active");
    expect((await stack.services.cards.due()).map((item) => item.id)).toContain(card.id);

    await stack.services.cards.remove(card.id);
    expect(await stack.services.cards.list()).toHaveLength(0);
    expect(await stack.repository.listEvents()).toHaveLength(1);
    stack.close();
  });

  it("exclui a matéria e preserva notas, cartões, PDFs e eventos", async () => {
    const stack = await openStack();
    const subject = await stack.services.subjects.create("Biologia", "#6558E8");
    const note = await stack.services.notes.create({ title: "Célula", subjectId: subject.id, text: "ATP" });
    const card = await stack.services.cards.create({ noteId: note.id, question: "Função?", answer: "ATP" });
    await stack.repository.putCard({ ...card, correctCount: 2 });
    const pdf = await stack.services.pdfs.importBytes("aula.pdf", pdfBytes(), subject.id);
    await stack.services.subjects.recolor(subject.id, "#73D8B2");
    expect((await stack.services.subjects.list())[0]?.color).toBe("#73D8B2");
    await stack.services.subjects.rename(subject.id, "Biologia celular");
    expect((await stack.services.cards.list())[0]?.subjectName).toBe("Biologia celular");

    await stack.services.subjects.remove(subject.id);
    expect(await stack.services.subjects.list()).toHaveLength(0);
    expect((await stack.services.notes.get(note.id))?.text).toBe("ATP");
    expect((await stack.services.notes.get(note.id))?.subjectId).toBeNull();
    const kept = (await stack.services.cards.list())[0];
    expect(kept?.subjectId).toBeNull();
    expect(kept?.subjectName).toBe("Sem matéria");
    expect(kept?.correctCount).toBe(2);
    expect((await stack.services.pdfs.get(pdf.id))?.subjectId).toBeNull();
    expect((await stack.repository.getSubject(subject.id))?.deletedAt).toBeTruthy();
    stack.close();
  });
});
