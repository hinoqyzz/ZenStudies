import Dexie, { type Table } from "dexie";
import type {
  AppMeta,
  Attachment,
  Card,
  FocusSession,
  Note,
  NoteDraft,
  NoteLink,
  PdfAnnotation,
  PdfDocument,
  ReviewEvent,
  ReviewSession,
  Subject,
  TrashItem,
} from "../../domain/models";

export const SCHEMA_V1 = {
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
} as const;

export const SCHEMA_V2 = {
  ...SCHEMA_V1,
  notes: "id, subjectId, deletedAt, updatedAt, origin, revision",
} as const;

const REVISION_TABLES = [
  "subjects",
  "notes",
  "links",
  "cards",
  "focusSessions",
  "attachments",
  "pdfs",
  "annotations",
] as const;

export class ZenDatabase extends Dexie {
  subjects!: Table<Subject, string>;
  notes!: Table<Note, string>;
  drafts!: Table<NoteDraft, string>;
  links!: Table<NoteLink, string>;
  cards!: Table<Card, string>;
  reviewEvents!: Table<ReviewEvent, string>;
  reviewSessions!: Table<ReviewSession, string>;
  focusSessions!: Table<FocusSession, string>;
  attachments!: Table<Attachment, string>;
  pdfs!: Table<PdfDocument, string>;
  annotations!: Table<PdfAnnotation, string>;
  trash!: Table<TrashItem, string>;
  meta!: Table<AppMeta, string>;

  constructor(name = "zenstudies") {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    this.version(2)
      .stores(SCHEMA_V2)
      .upgrade(async (transaction) => {
        for (const table of REVISION_TABLES) {
          await transaction.table(table).toCollection().modify((row: { revision?: number }) => {
            if (typeof row.revision !== "number") row.revision = 1;
          });
        }
      });
  }
}

export function createDatabase(name = "zenstudies"): ZenDatabase {
  return new ZenDatabase(name);
}
