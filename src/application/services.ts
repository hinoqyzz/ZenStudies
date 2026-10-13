import { collectNoteLinkIds, contentSignature, emptyDocument, extractText } from "../domain/content";
import { describePersistenceError } from "../domain/errors";
import { createId, nowIso } from "../domain/ids";
import {
  SCHEMA_VERSION,
  type AppMeta,
  type Attachment,
  type BackupData,
  type Card,
  type FocusSession,
  type Note,
  type NoteDraft,
  type Origin,
  type PdfAnnotation,
  type PdfDocument,
  type ReviewResponse,
  type RichContent,
  type Subject,
  type TrashItem,
} from "../domain/models";
import { annotationIsValid, normalizePoints, normalizeRect, restoreAnnotation, serializeAnnotation } from "../domain/annotations";
import { buildManifest, validateBackup } from "../domain/backup";
import { cleanMultiline, cleanPlain, cleanTitle, fileBaseName } from "../domain/sanitize";
import { isDueOnLocalDay, newCardSchedule } from "../domain/review/scheduler";
import { answerCard, currentCardId } from "../domain/review/session";
import { loadPreferences, preferencesForBackup, sanitizePreferences, savePreferences } from "../domain/preferences";
import type { DesktopGateway, StoredFile } from "../desktop/gateway";
import type { SyncBus } from "../desktop/sync-bus";
import { exportDataset } from "../repositories/dexie/dexie-repository";
import type { StudyRepository } from "../repositories/contracts";
import { buildDemoDataset } from "./demo-data";
import product from "../../product.json";

export class ConflictError extends Error {
  readonly current: Note;
  constructor(current: Note) {
    super("Esta nota foi alterada em outra janela.");
    this.name = "ConflictError";
    this.current = current;
  }
}

export interface SaveNoteInput {
  id: string;
  title: string;
  content: RichContent;
  text: string;
  subjectId: string | null;
  baseRevision: number;
  force?: boolean;
}

export interface StudyServices {
  ready(): Promise<void>;
  subjects: {
    list(): Promise<Subject[]>;
    create(name: string, color?: string): Promise<Subject>;
    rename(id: string, name: string): Promise<void>;
  };
  notes: {
    list(): Promise<Note[]>;
    get(id: string): Promise<Note | null>;
    create(input?: { title?: string; subjectId?: string | null; text?: string }): Promise<Note>;
    save(input: SaveNoteInput): Promise<{ ok: true; note: Note } | { ok: false; reason: "missing" } | { ok: false; reason: "conflict"; current: Note }>;
    saveDraft(draft: NoteDraft): Promise<void>;
    recovery(noteId: string): Promise<NoteDraft | null>;
    discardDraft(noteId: string): Promise<void>;
    setPinned(id: string, pinned: boolean): Promise<void>;
    setStatus(id: string, status: Note["status"]): Promise<void>;
    softDelete(id: string): Promise<TrashItem>;
  };
  links: {
    forNote(noteId: string): Promise<{ id: string; note: Note; source: "editor" | "manual" }[]>;
    connect(fromNoteId: string, toNoteId: string): Promise<void>;
  };
  cards: {
    list(): Promise<Card[]>;
    forNote(noteId: string): Promise<Card[]>;
    due(now?: Date): Promise<Card[]>;
    create(input: { noteId: string; question: string; answer: string; sourcePdfId?: string | null; sourcePage?: number | null; sourceAnnotationId?: string | null }): Promise<Card>;
    setState(id: string, state: Card["state"]): Promise<void>;
  };
  review: {
    active(): Promise<import("../domain/models").ReviewSession | null>;
    startOrResume(now?: Date): Promise<import("../domain/models").ReviewSession | null>;
    answer(sessionId: string, response: ReviewResponse, now?: Date): Promise<import("../domain/review/session").AnswerResult>;
    events(): Promise<import("../domain/models").ReviewEvent[]>;
  };
  focus: {
    active(): Promise<FocusSession | null>;
    start(input?: { noteId?: string | null; minutes?: number }): Promise<FocusSession>;
    complete(id: string): Promise<void>;
    cancel(id: string): Promise<void>;
  };
  attachments: {
    importBytes(noteId: string | null, name: string, bytes: Uint8Array, kind: "image" | "audio"): Promise<Attachment>;
    importPath(noteId: string | null, path: string, kind: "image" | "audio"): Promise<Attachment>;
    read(id: string): Promise<Uint8Array>;
    open(id: string): Promise<void>;
    relink(id: string, name: string, bytes: Uint8Array): Promise<Attachment>;
    updateCaption(id: string, alt: string, caption: string): Promise<void>;
    list(): Promise<Attachment[]>;
    orphans(): Promise<Attachment[]>;
    purgeOrphans(ids: string[]): Promise<number>;
  };
  pdfs: {
    list(): Promise<PdfDocument[]>;
    get(id: string): Promise<PdfDocument | null>;
    importPath(path: string, subjectId?: string | null): Promise<PdfDocument>;
    importBytes(name: string, bytes: Uint8Array, subjectId?: string | null): Promise<PdfDocument>;
    read(id: string): Promise<Uint8Array>;
    open(id: string): Promise<void>;
    updateProgress(id: string, page: number, pageCount: number, textLayerAvailable: boolean): Promise<void>;
    setBookmark(id: string, page: number | null): Promise<void>;
    setSubject(id: string, subjectId: string | null): Promise<void>;
    annotations(pdfId: string): Promise<PdfAnnotation[]>;
    saveAnnotation(input: Omit<PdfAnnotation, "id" | "createdAt" | "updatedAt" | "deletedAt" | "revision" | "author"> & { id?: string }): Promise<PdfAnnotation>;
    removeAnnotation(id: string): Promise<void>;
  };
  trash: {
    list(): Promise<TrashItem[]>;
    restore(id: string): Promise<void>;
    purge(id: string): Promise<void>;
    empty(): Promise<void>;
  };
  backup: {
    export(destination?: string): Promise<string | null>;
    inspect(path?: string): Promise<{ path: string; counts: Record<string, number> } | null>;
    merge(path: string): Promise<{ added: number; kept: number }>;
    replace(path: string): Promise<{ safetyPath: string }>;
  };
  demo: {
    has(): Promise<boolean>;
    seed(): Promise<void>;
    clear(): Promise<void>;
  };
  search(query: string): Promise<{ id: string; kind: "note" | "card" | "pdf" | "subject"; title: string; detail: string }[]>;
  meta(): Promise<AppMeta>;
  completeOnboarding(): Promise<void>;
  describeError(error: unknown): string;
  publish(type: "notes" | "cards" | "pdfs" | "library" | "trash" | "session" | "preferences", id?: string): void;
}

export function createStudyServices(
  repository: StudyRepository,
  desktop: DesktopGateway,
  sync: SyncBus,
): StudyServices {
  let answerTail: Promise<unknown> = Promise.resolve();
  let sessionTail: Promise<unknown> = Promise.resolve();
  const repo = repository;

  const publish = (type: "notes" | "cards" | "pdfs" | "library" | "trash" | "session" | "preferences", id?: string) => {
    sync.publish({ type, id });
  };

  async function ensureMeta(): Promise<AppMeta> {
    const existing = await repo.getMeta();
    if (existing) return existing;
    const meta: AppMeta = {
      id: "app",
      schemaVersion: SCHEMA_VERSION,
      installedAt: nowIso(),
      onboardingCompleted: false,
    };
    await repo.putMeta(meta);
    return meta;
  }

  async function subjectName(subjectId: string | null): Promise<string> {
    if (!subjectId) return "Sem matéria";
    const subject = await repo.getSubject(subjectId);
    return subject && !subject.deletedAt ? subject.name : "Sem matéria";
  }

  return {
    async ready() {
      await ensureMeta();
    },
    publish,
    describeError: describePersistenceError,
    meta: ensureMeta,
    async completeOnboarding() {
      const meta = await ensureMeta();
      await repo.putMeta({ ...meta, onboardingCompleted: true });
    },
    subjects: {
      async list() {
        const subjects = await repo.listSubjects();
        return subjects.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      },
      async create(name: string, color = "#6558E8") {
        const now = nowIso();
        const subject: Subject = {
          id: createId(),
          name: cleanTitle(name, "Nova matéria"),
          color,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          revision: 1,
          origin: "user",
        };
        await repo.putSubject(subject);
        publish("library", subject.id);
        return subject;
      },
      async rename(id: string, name: string) {
        const subject = await repo.getSubject(id);
        if (!subject || subject.deletedAt) throw new Error("Matéria não encontrada.");
        const now = nowIso();
        const nextName = cleanTitle(name, subject.name);
        await repo.transaction(async () => {
          await repo.putSubject({ ...subject, name: nextName, updatedAt: now, revision: subject.revision + 1 });
          const cards = await repo.listCards(true);
          for (const card of cards.filter((item) => item.subjectId === id)) {
            await repo.putCard({ ...card, subjectName: nextName, updatedAt: now, revision: card.revision + 1 });
          }
        });
        publish("library", id);
      },
    },
    notes: {
      async list() {
        const notes = await repo.listNotes();
        return notes.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
      },
      async get(id: string) {
        const note = await repo.getNote(id);
        return note && !note.deletedAt ? note : null;
      },
      async create(input = {}) {
        const now = nowIso();
        const content = input.text ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: input.text }] }] } : emptyDocument();
        const note: Note = {
          id: createId(),
          subjectId: input.subjectId ?? null,
          title: cleanTitle(input.title ?? "", "Sem título"),
          content,
          text: extractText(content),
          pinned: false,
          status: "studying",
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          revision: 1,
          origin: "user",
        };
        await repo.putNote(note);
        publish("notes", note.id);
        return note;
      },
      async save(input) {
        const current = await repo.getNote(input.id);
        if (!current || current.deletedAt) return { ok: false as const, reason: "missing" as const };
        if (current.revision !== input.baseRevision && !input.force) return { ok: false as const, reason: "conflict" as const, current };
        const now = nowIso();
        const next: Note = {
          ...current,
          title: cleanTitle(input.title, "Sem título"),
          content: input.content,
          text: input.text,
          subjectId: input.subjectId,
          updatedAt: now,
          revision: current.revision + 1,
        };
        await repo.transaction(async () => {
          await repo.putNote(next);
          await syncEditorLinks(repo, next);
          await repo.deleteDraft(next.id);
        });
        publish("notes", next.id);
        return { ok: true as const, note: next };
      },
      async saveDraft(draft) {
        await repo.putDraft({ ...draft, id: draft.noteId, noteId: draft.noteId, updatedAt: draft.updatedAt || nowIso() });
      },
      async recovery(noteId) {
        const [draft, note] = await Promise.all([repo.getDraft(noteId), repo.getNote(noteId)]);
        if (!draft || !note) return null;
        if (draft.updatedAt <= note.updatedAt) return null;
        if (draft.text === note.text && contentSignature(draft.content) === contentSignature(note.content) && draft.title === note.title) return null;
        return draft;
      },
      async discardDraft(noteId) {
        await repo.deleteDraft(noteId);
      },
      async setPinned(id, pinned) {
        const note = await mustNote(repo, id);
        const next = { ...note, pinned, updatedAt: nowIso(), revision: note.revision + 1 };
        await repo.putNote(next);
        publish("notes", id);
      },
      async setStatus(id, status) {
        const note = await mustNote(repo, id);
        await repo.putNote({ ...note, status, updatedAt: nowIso(), revision: note.revision + 1 });
        publish("notes", id);
      },
      async softDelete(id) {
        const note = await mustNote(repo, id);
        const deletedAt = nowIso();
        const links = (await repo.listLinks()).filter((link) => !link.deletedAt && (link.fromNoteId === id || link.toNoteId === id));
        const cards = (await repo.listCards()).filter((card) => card.noteId === id);
        const annotations = (await repo.listAnnotations()).filter((annotation) => !annotation.deletedAt && annotation.noteId === id);
        const item: TrashItem = {
          id: createId(),
          entityType: "note",
          entityId: id,
          title: note.title,
          deletedAt,
          origin: note.origin,
          snapshot: {
            linkIds: links.map((link) => link.id),
            cardIds: cards.map((card) => card.id),
            annotationIds: annotations.map((annotation) => annotation.id),
          },
        };
        await repo.transaction(async () => {
          await repo.putNote({ ...note, deletedAt, updatedAt: deletedAt, revision: note.revision + 1 });
          for (const link of links) await repo.putLink({ ...link, deletedAt, updatedAt: deletedAt, revision: link.revision + 1 });
          for (const card of cards) await repo.putCard({ ...card, deletedAt, updatedAt: deletedAt, revision: card.revision + 1 });
          for (const annotation of annotations) await repo.putAnnotation({ ...annotation, deletedAt, updatedAt: deletedAt, revision: annotation.revision + 1 });
          await repo.putTrash(item);
        });
        publish("trash", item.id);
        publish("notes", id);
        return item;
      },
    },
    links: {
      async forNote(noteId) {
        const links = (await repo.listLinks()).filter((link) => !link.deletedAt && (link.fromNoteId === noteId || link.toNoteId === noteId));
        const notes = await repo.listNotes();
        const byId = new Map(notes.map((note) => [note.id, note]));
        return links.flatMap((link) => {
          const otherId = link.fromNoteId === noteId ? link.toNoteId : link.fromNoteId;
          const note = byId.get(otherId);
          if (!note) return [];
          return [{ id: link.id, note, source: link.source }];
        });
      },
      async connect(fromNoteId, toNoteId) {
        if (fromNoteId === toNoteId) return;
        const existing = (await repo.listLinks()).find((link) => !link.deletedAt && link.fromNoteId === fromNoteId && link.toNoteId === toNoteId);
        if (existing) return;
        const now = nowIso();
        await repo.putLink({
          id: createId(),
          fromNoteId,
          toNoteId,
          source: "manual",
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          revision: 1,
          origin: "user",
        });
        publish("notes", fromNoteId);
      },
    },
    cards: {
      async list() {
        return (await repo.listCards()).sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt));
      },
      async forNote(noteId) {
        return (await repo.listCards()).filter((card) => card.noteId === noteId);
      },
      async due(now = new Date()) {
        return (await repo.listCards())
          .filter((card) => isDueOnLocalDay(card.nextReviewAt, now, card.state, card.deletedAt))
          .sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt));
      },
      async create(input) {
        const note = await repo.getNote(input.noteId);
        const now = new Date();
        const card: Card = {
          id: createId(),
          noteId: input.noteId,
          subjectId: note?.subjectId ?? null,
          subjectName: await subjectName(note?.subjectId ?? null),
          question: cleanPlain(input.question, 1000),
          answer: cleanMultiline(input.answer),
          createdAt: nowIso(now),
          updatedAt: nowIso(now),
          deletedAt: null,
          revision: 1,
          origin: "user",
          sourcePdfId: input.sourcePdfId ?? null,
          sourcePage: input.sourcePage ?? null,
          sourceAnnotationId: input.sourceAnnotationId ?? null,
          ...newCardSchedule(now),
        };
        if (!card.question || !card.answer) throw new Error("O cartão precisa de pergunta e resposta.");
        await repo.putCard(card);
        publish("cards", card.id);
        return card;
      },
      async setState(id, state) {
        const card = await repo.getCard(id);
        if (!card || card.deletedAt) throw new Error("Cartão não encontrado.");
        await repo.putCard({ ...card, state, updatedAt: nowIso(), revision: card.revision + 1 });
        publish("cards", id);
      },
    },
    review: {
      async active() {
        const sessions = await repo.listSessions();
        return sessions.find((session) => session.status === "active") ?? null;
      },
      startOrResume(now = new Date()) {
        const run = sessionTail.then(() => repo.transaction(async () => {
          const sessions = await repo.listSessions();
          const active = sessions
            .filter((session) => session.status === "active")
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
          const current = active[0];
          if (current) {
            await Promise.all(active.slice(1).map((extra) => repo.putSession({
              ...extra,
              status: "completed",
              completedAt: extra.completedAt ?? nowIso(now),
              updatedAt: nowIso(now),
            })));
            return current;
          }
          const due = (await repo.listCards()).filter((card) => isDueOnLocalDay(card.nextReviewAt, now, card.state, card.deletedAt));
          if (due.length === 0) return null;
          const session = {
            id: createId(),
            startedAt: nowIso(now),
            updatedAt: nowIso(now),
            completedAt: null,
            cardIds: due.map((card) => card.id),
            position: 0,
            responses: [],
            status: "active" as const,
          };
          await repo.putSession(session);
          publish("session", session.id);
          return session;
        }));
        sessionTail = run.then(() => undefined, () => undefined);
        return run;
      },
      answer(sessionId, response, now = new Date()) {
        const run = answerTail.then(() =>
          repo.transaction(async () => {
            const session = await repo.getSession(sessionId);
            if (!session) throw new Error("Sessão não encontrada.");
            const cardId = currentCardId(session);
            if (!cardId) throw new Error("A sessão não tem cartão pendente.");
            const card = await repo.getCard(cardId);
            if (!card || card.deletedAt) throw new Error("Cartão não encontrado.");
            const result = answerCard(session, card, response, now, createId());
            await repo.putSession(result.session);
            await repo.putCard(result.card);
            await repo.putEvent(result.event);
            publish("session", sessionId);
            publish("cards");
            return result;
          }),
        );
        answerTail = run.then(
          () => undefined,
          () => undefined,
        );
        return run;
      },
      async events() {
        const events = await repo.listEvents();
        return events.sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
      },
    },
    focus: {
      async active() {
        const sessions = await repo.listFocus();
        return sessions.find((session) => session.status === "active") ?? null;
      },
      async start(input = {}) {
        const existing = (await repo.listFocus()).find((session) => session.status === "active");
        if (existing) return existing;
        const note = input.noteId ? await repo.getNote(input.noteId) : null;
        const now = nowIso();
        const session: FocusSession = {
          id: createId(),
          noteId: note?.id ?? null,
          subjectId: note?.subjectId ?? null,
          title: note?.title ?? "Sessão de foco",
          plannedMinutes: input.minutes ?? loadPreferences().focusMinutes,
          startedAt: now,
          endedAt: null,
          status: "active",
          revision: 1,
        };
        await repo.putFocus(session);
        publish("session", session.id);
        return session;
      },
      async complete(id) {
        const session = await getFocus(repo, id);
        await repo.putFocus({ ...session, status: "completed", endedAt: nowIso(), revision: session.revision + 1 });
        publish("session", id);
      },
      async cancel(id) {
        const session = await getFocus(repo, id);
        await repo.putFocus({ ...session, status: "cancelled", endedAt: nowIso(), revision: session.revision + 1 });
        publish("session", id);
      },
    },
    attachments: {
      importBytes: (noteId, name, bytes, kind) => storeAttachment(repo, desktop, publish, noteId, () => desktop.importBytes(name, bytes, kind), "user"),
      importPath: (noteId, path, kind) => storeAttachment(repo, desktop, publish, noteId, () => desktop.importPath(path, kind), "user"),
      async read(id) {
        const attachment = await mustAttachment(repo, id);
        return desktop.read(attachment.relativePath);
      },
      async open(id) {
        const attachment = await mustAttachment(repo, id);
        await desktop.open(attachment.relativePath);
      },
      async relink(id, name, bytes) {
        const attachment = await mustAttachment(repo, id);
        const stored = await desktop.importBytes(name, bytes, attachment.kind);
        const next = { ...attachment, ...storedMeta(stored), originalName: fileBaseName(name), updatedAt: nowIso(), revision: attachment.revision + 1 };
        await repo.putAttachment(next);
        publish("notes", id);
        return next;
      },
      async updateCaption(id, alt, caption) {
        const attachment = await mustAttachment(repo, id);
        await repo.putAttachment({ ...attachment, alt: cleanPlain(alt, 300), caption: cleanPlain(caption, 500), updatedAt: nowIso(), revision: attachment.revision + 1 });
      },
      list: () => repo.listAttachments(),
      async orphans() {
        const [attachments, notes] = await Promise.all([repo.listAttachments(true), repo.listNotes(true)]);
        const used = new Set(notes.flatMap((note) => collectReferencedAttachments(note)));
        return attachments.filter((attachment) => !attachment.deletedAt && !used.has(attachment.id));
      },
      async purgeOrphans(ids) {
        const [attachments, notes] = await Promise.all([repo.listAttachments(true), repo.listNotes(true)]);
        const used = new Set(notes.flatMap((note) => collectReferencedAttachments(note)));
        const orphans = new Set(attachments.filter((attachment) => !attachment.deletedAt && !used.has(attachment.id)).map((item) => item.id));
        let removed = 0;
        for (const id of ids) {
          if (!orphans.has(id)) continue;
          const attachment = await repo.getAttachment(id);
          if (!attachment) continue;
          await repo.deleteAttachment(id);
          if (await desktop.exists(attachment.relativePath)) await desktop.remove(attachment.relativePath);
          removed += 1;
        }
        publish("library");
        return removed;
      },
    },
    pdfs: {
      async list() {
        const pdfs = await repo.listPdfs();
        return pdfs.sort((a, b) => (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt));
      },
      async get(id) {
        const pdf = await repo.getPdf(id);
        return pdf && !pdf.deletedAt ? pdf : null;
      },
      async importPath(path, subjectId = null) {
        const stored = await desktop.importPath(path, "pdf");
        return rememberPdf(repo, publish, stored, subjectId);
      },
      async importBytes(name, bytes, subjectId = null) {
        const stored = await desktop.importBytes(name, bytes, "pdf");
        return rememberPdf(repo, publish, stored, subjectId);
      },
      async read(id) {
        const pdf = await mustPdf(repo, id);
        return desktop.read(pdf.relativePath);
      },
      async open(id) {
        const pdf = await mustPdf(repo, id);
        await desktop.open(pdf.relativePath);
      },
      async updateProgress(id, page, pageCount, textLayerAvailable) {
        const pdf = await mustPdf(repo, id);
        await repo.putPdf({
          ...pdf,
          progressPage: page,
          pageCount,
          textLayerAvailable,
          lastOpenedAt: nowIso(),
          updatedAt: nowIso(),
          revision: pdf.revision + 1,
        });
        publish("pdfs", id);
      },
      async setBookmark(id, page) {
        const pdf = await mustPdf(repo, id);
        await repo.putPdf({ ...pdf, bookmarkPage: page, updatedAt: nowIso(), revision: pdf.revision + 1 });
        publish("pdfs", id);
      },
      async setSubject(id, subjectId) {
        const pdf = await mustPdf(repo, id);
        await repo.putPdf({ ...pdf, subjectId, updatedAt: nowIso(), revision: pdf.revision + 1 });
        publish("pdfs", id);
      },
      async annotations(pdfId) {
        return (await repo.listAnnotations(pdfId)).filter((annotation) => !annotation.deletedAt).sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt));
      },
      async saveAnnotation(input) {
        if (!annotationIsValid(input)) throw new Error("A marcação está incompleta ou usa uma cor fora da paleta.");
        const now = nowIso();
        const rects = input.rects.map(normalizeRect).filter((rect): rect is NonNullable<typeof rect> => rect !== null);
        const annotation: PdfAnnotation = {
          id: input.id ?? createId(),
          pdfId: input.pdfId,
          page: input.page,
          type: input.type,
          color: input.color,
          rects,
          points: normalizePoints(input.points),
          selectedText: input.selectedText ? cleanMultiline(input.selectedText, 4000) : null,
          comment: input.comment ? cleanMultiline(input.comment, 4000) : null,
          author: "local",
          noteId: input.noteId,
          cardId: input.cardId,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          revision: 1,
        };
        const existing = input.id ? await repo.getAnnotation(input.id) : undefined;
        if (existing) {
          annotation.createdAt = existing.createdAt;
          annotation.revision = existing.revision + 1;
        }
        await repo.putAnnotation(annotation);
        publish("pdfs", annotation.pdfId);
        return annotation;
      },
      async removeAnnotation(id) {
        const annotation = await repo.getAnnotation(id);
        if (!annotation) return;
        await repo.putAnnotation({ ...annotation, deletedAt: nowIso(), updatedAt: nowIso(), revision: annotation.revision + 1 });
        publish("pdfs", annotation.pdfId);
      },
    },
    trash: {
      list: () => repo.listTrash().then((items) => items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))),
      async restore(id) {
        const item = await repo.getTrash(id);
        if (!item) throw new Error("Item da lixeira não encontrado.");
        await restoreTrash(repo, item);
        await repo.deleteTrash(id);
        publish("trash", id);
        publish("notes");
      },
      async purge(id) {
        const item = await repo.getTrash(id);
        if (!item) return;
        await purgeTrash(repo, desktop, item);
        publish("trash", id);
      },
      async empty() {
        const items = await repo.listTrash();
        for (const item of items) await purgeTrash(repo, desktop, item);
        publish("trash");
      },
    },
    backup: {
      async export(destination) {
        const path = destination ?? (await desktop.pickSave(`zenstudies-backup.zenbackup`));
        if (!path) return null;
        await writeBackup(repo, desktop, path);
        return path;
      },
      async inspect(path) {
        const selected = path ?? (await desktop.pickOpen([{ name: "Backup ZenStudies", extensions: ["zenbackup"] }]));
        if (!selected) return null;
        const raw = await desktop.inspectBackup(selected);
        const validated = await validateBackup(raw.manifest, raw.data);
        if (!validated.ok) throw new Error(validated.reason);
        return {
          path: selected,
          counts: {
            notas: validated.data.notes.length,
            cartões: validated.data.cards.length,
            pdfs: validated.data.pdfs.length,
            anexos: validated.data.attachments.length,
            marcações: validated.data.annotations.length,
          },
        };
      },
      async merge(path) {
        const raw = await desktop.inspectBackup(path);
        const validated = await validateBackup(raw.manifest, raw.data);
        if (!validated.ok) throw new Error(validated.reason);
        await desktop.restoreBackupFiles(path);
        const result = await repo.mergeMissing(validated.data);
        applyImportedPreferences(validated.data.preferences);
        publish("library");
        return result;
      },
      async replace(path) {
        const raw = await desktop.inspectBackup(path);
        const validated = await validateBackup(raw.manifest, raw.data);
        if (!validated.ok) throw new Error(validated.reason);
        const safetyPath = await desktop.safetyBackupPath();
        await writeBackup(repo, desktop, safetyPath);
        await desktop.restoreBackupFiles(path);
        await repo.replaceAll(validated.data);
        await desktop.pruneStorage(validated.manifest.files.map((file) => file.path));
        applyImportedPreferences(validated.data.preferences);
        publish("library");
        return { safetyPath };
      },
    },
    demo: {
      async has() {
        const notes = await repo.listNotes(true);
        return notes.some((note) => note.origin === "demo");
      },
      async seed() {
        if (await (await repo.listNotes(true)).some((note) => note.origin === "demo")) return;
        const demo = buildDemoDataset();
        await repo.transaction(async () => {
          for (const subject of demo.subjects) await repo.putSubject(subject);
          for (const note of demo.notes) await repo.putNote(note);
          for (const link of demo.links) await repo.putLink(link);
          for (const card of demo.cards) await repo.putCard(card);
        });
        publish("library");
      },
      async clear() {
        const [subjects, notes, links, cards, events] = await Promise.all([
          repo.listSubjects(true),
          repo.listNotes(true),
          repo.listLinks(),
          repo.listCards(true),
          repo.listEvents(),
        ]);
        const demoSubjectIds = new Set(subjects.filter((subject) => subject.origin === "demo").map((subject) => subject.id));
        const demoNoteIds = new Set(notes.filter((note) => note.origin === "demo").map((note) => note.id));
        const demoCardIds = new Set(cards.filter((card) => card.origin === "demo").map((card) => card.id));
        await repo.transaction(async () => {
          for (const subject of subjects) if (subject.origin === "demo") await repo.deleteSubject(subject.id);
          for (const note of notes) if (note.origin === "demo") await repo.deleteNote(note.id);
          for (const link of links) if (demoNoteIds.has(link.fromNoteId) || demoNoteIds.has(link.toNoteId)) await repo.deleteLink(link.id);
          for (const card of cards) {
            if (card.origin === "demo") {
              await repo.deleteCard(card.id);
              continue;
            }
            const next = { ...card };
            let changed = false;
            if (next.subjectId && demoSubjectIds.has(next.subjectId)) {
              next.subjectId = null;
              changed = true;
            }
            if (changed) await repo.putCard({ ...next, updatedAt: nowIso(), revision: next.revision + 1 });
          }
          for (const event of events) if (demoCardIds.has(event.cardId)) await repo.deleteEvent(event.id);
          const trash = await repo.listTrash();
          for (const item of trash) if (item.origin === "demo") await repo.deleteTrash(item.id);
        });
        publish("library");
      },
    },
    async search(query) {
      const needle = query.trim().toLocaleLowerCase("pt-BR");
      if (!needle) return [];
      const [notes, cards, pdfs, subjects] = await Promise.all([repo.listNotes(), repo.listCards(), repo.listPdfs(), repo.listSubjects()]);
      const hits = [
        ...notes.filter((note) => `${note.title} ${note.text}`.toLocaleLowerCase("pt-BR").includes(needle)).map((note) => ({ id: note.id, kind: "note" as const, title: note.title, detail: note.text.slice(0, 120) })),
        ...cards.filter((card) => `${card.question} ${card.answer}`.toLocaleLowerCase("pt-BR").includes(needle)).map((card) => ({ id: card.id, kind: "card" as const, title: card.question, detail: card.subjectName })),
        ...pdfs.filter((pdf) => pdf.title.toLocaleLowerCase("pt-BR").includes(needle)).map((pdf) => ({ id: pdf.id, kind: "pdf" as const, title: pdf.title, detail: "PDF" })),
        ...subjects.filter((subject) => subject.name.toLocaleLowerCase("pt-BR").includes(needle)).map((subject) => ({ id: subject.id, kind: "subject" as const, title: subject.name, detail: "Matéria" })),
      ];
      return hits.slice(0, 12);
    },
  };
}

function collectReferencedAttachments(note: Note): string[] {
  const ids: string[] = [];
  const walk = (node: RichContent | undefined) => {
    if (!node) return;
    if ((node.type === "imageAttachment" || node.type === "audioAttachment") && typeof node.attrs?.attachmentId === "string") ids.push(node.attrs.attachmentId);
    node.content?.forEach(walk);
  };
  walk(note.content);
  return ids;
}

async function syncEditorLinks(repo: StudyRepository, note: Note) {
  const targets = new Set(collectNoteLinkIds(note.content).filter((id) => id !== note.id));
  const links = await repo.listLinks();
  const now = nowIso();
  for (const link of links.filter((item) => item.fromNoteId === note.id && item.source === "editor")) {
    if (!targets.has(link.toNoteId) && !link.deletedAt) {
      await repo.putLink({ ...link, deletedAt: now, updatedAt: now, revision: link.revision + 1 });
    }
    if (targets.has(link.toNoteId) && link.deletedAt) {
      await repo.putLink({ ...link, deletedAt: null, updatedAt: now, revision: link.revision + 1 });
    }
    targets.delete(link.toNoteId);
  }
  for (const toNoteId of targets) {
    await repo.putLink({
      id: createId(),
      fromNoteId: note.id,
      toNoteId,
      source: "editor",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      revision: 1,
      origin: note.origin,
    });
  }
}

async function mustNote(repo: StudyRepository, id: string): Promise<Note> {
  const note = await repo.getNote(id);
  if (!note || note.deletedAt) throw new Error("Nota não encontrada.");
  return note;
}

async function mustAttachment(repo: StudyRepository, id: string): Promise<Attachment> {
  const attachment = await repo.getAttachment(id);
  if (!attachment || attachment.deletedAt) throw new Error("Anexo não encontrado.");
  return attachment;
}

async function mustPdf(repo: StudyRepository, id: string): Promise<PdfDocument> {
  const pdf = await repo.getPdf(id);
  if (!pdf || pdf.deletedAt) throw new Error("PDF não encontrado.");
  return pdf;
}

async function getFocus(repo: StudyRepository, id: string): Promise<FocusSession> {
  const session = (await repo.listFocus()).find((item) => item.id === id);
  if (!session) throw new Error("Sessão de foco não encontrada.");
  return session;
}

function storedMeta(stored: StoredFile) {
  return {
    relativePath: stored.relativePath,
    sha256: stored.sha256,
    sizeBytes: stored.sizeBytes,
    mimeType: stored.mimeType,
    extension: stored.extension,
  };
}

async function storeAttachment(
  repo: StudyRepository,
  _desktop: DesktopGateway,
  publish: StudyServices["publish"],
  noteId: string | null,
  load: () => Promise<StoredFile>,
  origin: Origin,
): Promise<Attachment> {
  const stored = await load();
  const now = nowIso();
  const attachment: Attachment = {
    id: createId(),
    noteId,
    kind: stored.mimeType.startsWith("audio/") ? "audio" : "image",
    originalName: fileBaseName(stored.originalName),
    alt: "",
    caption: "",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    revision: 1,
    origin,
    ...storedMeta(stored),
    mimeType: stored.mimeType,
  };
  await repo.putAttachment(attachment);
  publish("notes", attachment.id);
  return attachment;
}

async function rememberPdf(repo: StudyRepository, publish: StudyServices["publish"], stored: StoredFile, subjectId: string | null): Promise<PdfDocument> {
  const now = nowIso();
  const pdf: PdfDocument = {
    id: createId(),
    subjectId,
    title: fileBaseName(stored.originalName).replace(/\.pdf$/i, ""),
    originalName: fileBaseName(stored.originalName),
    relativePath: stored.relativePath,
    mimeType: "application/pdf",
    sizeBytes: stored.sizeBytes,
    pageCount: 0,
    progressPage: 1,
    lastOpenedAt: null,
    bookmarkPage: null,
    sha256: stored.sha256,
    textLayerAvailable: null,
    protected: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    revision: 1,
    origin: "user",
  };
  await repo.putPdf(pdf);
  publish("pdfs", pdf.id);
  return pdf;
}

async function restoreTrash(repo: StudyRepository, item: TrashItem) {
  const now = nowIso();
  await repo.transaction(async () => {
    if (item.entityType === "note") {
      const note = await repo.getNote(item.entityId);
      if (note) await repo.putNote({ ...note, deletedAt: null, updatedAt: now, revision: note.revision + 1 });
      for (const linkId of item.snapshot.linkIds) {
        const link = (await repo.listLinks()).find((entry) => entry.id === linkId);
        if (link && link.deletedAt === item.deletedAt) await repo.putLink({ ...link, deletedAt: null, updatedAt: now, revision: link.revision + 1 });
      }
      for (const cardId of item.snapshot.cardIds) {
        const card = await repo.getCard(cardId);
        if (card && card.deletedAt === item.deletedAt) await repo.putCard({ ...card, deletedAt: null, updatedAt: now, revision: card.revision + 1 });
      }
      for (const annotationId of item.snapshot.annotationIds) {
        const annotation = await repo.getAnnotation(annotationId);
        if (annotation && annotation.deletedAt === item.deletedAt) await repo.putAnnotation({ ...annotation, deletedAt: null, updatedAt: now, revision: annotation.revision + 1 });
      }
    }
  });
}

async function purgeTrash(repo: StudyRepository, desktop: DesktopGateway, item: TrashItem) {
  await repo.transaction(async () => {
    if (item.entityType === "note") {
      await repo.deleteNote(item.entityId);
      for (const linkId of item.snapshot.linkIds) await repo.deleteLink(linkId);
      for (const cardId of item.snapshot.cardIds) await repo.deleteCard(cardId);
      for (const annotationId of item.snapshot.annotationIds) await repo.deleteAnnotation(annotationId);
    }
    if (item.entityType === "pdf") {
      const pdf = await repo.getPdf(item.entityId);
      if (pdf && (await desktop.exists(pdf.relativePath))) await desktop.remove(pdf.relativePath);
      await repo.deletePdf(item.entityId);
    }
    await repo.deleteTrash(item.id);
  });
}

async function writeBackup(repo: StudyRepository, desktop: DesktopGateway, path: string) {
  const dataset = await repo.transaction(() => exportDataset(repo));
  const data: BackupData = { ...dataset, preferences: preferencesForBackup(loadPreferences()) };
  const relativePaths = [...new Set([...data.attachments.map((item) => item.relativePath), ...data.pdfs.map((item) => item.relativePath)])];
  const files = [];
  for (const relative of relativePaths) {
    if (!(await desktop.exists(relative))) {
      throw new Error(`O arquivo interno ${relative} não foi encontrado. O backup não foi gravado.`);
    }
    const bytes = await desktop.read(relative);
    const { sha256Hex } = await import("../domain/backup");
    files.push({ path: relative, sha256: await sha256Hex(bytes), bytes: bytes.byteLength });
  }
  const built = await buildManifest({
    appVersion: product.version,
    createdAt: nowIso(),
    data,
    files,
  });
  await desktop.writeBackup(path, JSON.stringify(built.manifest), built.dataJson, relativePaths);
}

function applyImportedPreferences(preferences: BackupData["preferences"]) {
  const current = loadPreferences();
  savePreferences(sanitizePreferences({ ...current, ...preferences, preloaderSeen: current.preloaderSeen, closeToTrayExplained: current.closeToTrayExplained }));
}

export function roundTripAnnotation(annotation: PdfAnnotation): PdfAnnotation {
  return restoreAnnotation(serializeAnnotation(annotation));
}
