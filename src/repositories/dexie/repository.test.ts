import { describe, expect, it } from "vitest";
import { emptyDocument } from "../../domain/content";
import type { Note } from "../../domain/models";
import { openStack } from "../../test/harness";

describe("transações do repositório", () => {
  it("desfaz a gravação quando a transação falha", async () => {
    const stack = await openStack();
    const note = sampleNote("n1");
    await expect(stack.repository.transaction(async () => {
      await stack.repository.putNote(note);
      throw new Error("falha proposital");
    })).rejects.toThrow("falha proposital");
    expect(await stack.repository.getNote("n1")).toBeUndefined();
    stack.close();
  });

  it("grava nota e rascunho na mesma transação", async () => {
    const stack = await openStack();
    const note = sampleNote("n2");
    await stack.repository.transaction(async () => {
      await stack.repository.putNote(note);
      await stack.repository.putDraft({
        id: note.id,
        noteId: note.id,
        title: note.title,
        content: note.content,
        text: "rascunho",
        baseRevision: 1,
        updatedAt: "2026-10-12T12:00:00.000Z",
      });
    });
    expect((await stack.repository.getNote("n2"))?.title).toBe("Nota");
    expect((await stack.repository.getDraft("n2"))?.text).toBe("rascunho");
    stack.close();
  });
});

function sampleNote(id: string): Note {
  return {
    id,
    subjectId: null,
    title: "Nota",
    content: emptyDocument(),
    text: "Nota",
    pinned: false,
    status: "studying",
    createdAt: "2026-10-12T12:00:00.000Z",
    updatedAt: "2026-10-12T12:00:00.000Z",
    deletedAt: null,
    revision: 1,
    origin: "user",
  };
}
