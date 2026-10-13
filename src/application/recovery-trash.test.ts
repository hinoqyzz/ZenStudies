import { describe, expect, it } from "vitest";
import { documentFromText } from "../domain/content";
import { openStack } from "../test/harness";

describe("rascunho e lixeira", () => {
  it("recupera um rascunho mais recente e permite descartá-lo", async () => {
    const stack = await openStack();
    const note = await stack.services.notes.create({ title: "Mitocôndria", text: "versão salva" });
    await stack.services.notes.saveDraft({
      id: note.id,
      noteId: note.id,
      title: "Mitocôndria",
      content: documentFromText("versão do rascunho"),
      text: "versão do rascunho",
      baseRevision: note.revision,
      updatedAt: new Date(Date.now() + 5_000).toISOString(),
    });
    const draft = await stack.services.notes.recovery(note.id);
    expect(draft?.text).toBe("versão do rascunho");
    if (!draft) throw new Error("rascunho ausente");
    await stack.services.notes.saveDraft({
      ...draft,
      text: note.text,
      content: note.content,
      title: note.title,
      updatedAt: new Date(Date.now() + 8_000).toISOString(),
    });
    expect(await stack.services.notes.recovery(note.id)).toBeNull();
    await stack.services.notes.discardDraft(note.id);
    expect(await stack.repository.getDraft(note.id)).toBeUndefined();
    stack.close();
  });

  it("restaura nota, conexão e cartão depois da exclusão lógica", async () => {
    const stack = await openStack();
    const subject = await stack.services.subjects.create("Biologia celular");
    const origin = await stack.services.notes.create({ title: "Mitocôndria", subjectId: subject.id, text: "produz ATP" });
    const related = await stack.services.notes.create({ title: "Krebs", subjectId: subject.id, text: "ciclo" });
    await stack.services.links.connect(origin.id, related.id);
    const card = await stack.services.cards.create({ noteId: origin.id, question: "O que produz?", answer: "ATP" });
    const trashed = await stack.services.notes.softDelete(origin.id);
    expect(await stack.services.notes.get(origin.id)).toBeNull();
    expect(await stack.services.cards.forNote(origin.id)).toEqual([]);
    await stack.services.trash.restore(trashed.id);
    const restored = await stack.services.notes.get(origin.id);
    expect(restored?.text).toBe("produz ATP");
    expect(restored?.deletedAt).toBeNull();
    const cards = await stack.services.cards.forNote(origin.id);
    expect(cards.map((item) => item.id)).toEqual([card.id]);
    const links = await stack.services.links.forNote(origin.id);
    expect(links.map((item) => item.note.id)).toEqual([related.id]);
    stack.close();
  });
});
