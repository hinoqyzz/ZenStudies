import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { createDatabase } from "./database";

describe("banco Dexie", () => {
  it("abre na versão 2", async () => {
    const database = createDatabase(`zen-open-${crypto.randomUUID()}`);
    await database.open();
    expect(database.verno).toBe(2);
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      "annotations",
      "attachments",
      "cards",
      "drafts",
      "focusSessions",
      "links",
      "meta",
      "notes",
      "pdfs",
      "reviewEvents",
      "reviewSessions",
      "subjects",
      "trash",
    ]);
    database.close();
  });

  it("preenche revision ao migrar da versão 1", async () => {
    const name = `zen-migrate-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      subjects: "id, deletedAt, origin, updatedAt",
      notes: "id, subjectId, deletedAt, updatedAt, origin",
      drafts: "id, noteId, updatedAt",
      links: "id, fromNoteId, toNoteId, deletedAt",
      cards: "id, noteId, subjectId, state, nextReviewAt, deletedAt, origin",
      reviewEvents: "id, cardId, sessionId, reviewedAt",
      reviewSessions: "id, status, updatedAt",
      focusSessions: "id, status, noteId, startedAt",
      attachments: "id, noteId, deletedAt, relativePath",
      pdfs: "id, subjectId, deletedAt, lastOpenedAt, origin",
      annotations: "id, pdfId, page, deletedAt, noteId",
      trash: "id, entityId, deletedAt, entityType",
      meta: "id",
    });
    await legacy.open();
    await legacy.table("notes").add({
      id: "nota-antiga",
      subjectId: null,
      title: "Antes da revisão",
      content: { type: "doc" },
      text: "texto",
      pinned: false,
      status: "studying",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      origin: "user",
    });
    legacy.close();

    const upgraded = createDatabase(name);
    await upgraded.open();
    const note = await upgraded.notes.get("nota-antiga");
    expect(note?.revision).toBe(1);
    expect(note?.title).toBe("Antes da revisão");
    upgraded.close();
  });
});
