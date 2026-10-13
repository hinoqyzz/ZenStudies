import type { BackupData, NoteDraft } from "../../domain/models";
import type { StudyRepository } from "../contracts";
import { ZenDatabase } from "./database";

type Dataset = Omit<BackupData, "preferences">;

export class DexieStudyRepository implements StudyRepository {
  constructor(private readonly db: ZenDatabase) {}

  private async done(work: Promise<unknown>): Promise<void> {
    await work;
  }

  transaction<T>(work: () => Promise<T>): Promise<T> {
    return this.db.transaction(
      "rw",
      [
        this.db.subjects,
        this.db.notes,
        this.db.drafts,
        this.db.links,
        this.db.cards,
        this.db.reviewEvents,
        this.db.reviewSessions,
        this.db.focusSessions,
        this.db.attachments,
        this.db.pdfs,
        this.db.annotations,
        this.db.trash,
        this.db.meta,
      ],
      work,
    );
  }

  getMeta() {
    return this.db.meta.get("app");
  }
  putMeta(meta: Dataset["meta"]) {
    return this.done(this.db.meta.put(meta));
  }
  async listSubjects(includeDeleted = false) {
    const rows = await this.db.subjects.toArray();
    return includeDeleted ? rows : rows.filter((row) => !row.deletedAt);
  }
  getSubject(id: string) {
    return this.db.subjects.get(id);
  }
  putSubject(subject: Dataset["subjects"][number]) {
    return this.done(this.db.subjects.put(subject));
  }
  deleteSubject(id: string) {
    return this.db.subjects.delete(id);
  }
  async listNotes(includeDeleted = false) {
    const rows = await this.db.notes.toArray();
    return includeDeleted ? rows : rows.filter((row) => !row.deletedAt);
  }
  getNote(id: string) {
    return this.db.notes.get(id);
  }
  putNote(note: Dataset["notes"][number]) {
    return this.done(this.db.notes.put(note));
  }
  deleteNote(id: string) {
    return this.db.notes.delete(id);
  }
  getDraft(noteId: string) {
    return this.db.drafts.get(noteId);
  }
  putDraft(draft: NoteDraft) {
    return this.done(this.db.drafts.put(draft));
  }
  deleteDraft(noteId: string) {
    return this.db.drafts.delete(noteId);
  }
  listLinks() {
    return this.db.links.toArray();
  }
  putLink(link: Dataset["links"][number]) {
    return this.done(this.db.links.put(link));
  }
  deleteLink(id: string) {
    return this.db.links.delete(id);
  }
  async listCards(includeDeleted = false) {
    const rows = await this.db.cards.toArray();
    return includeDeleted ? rows : rows.filter((row) => !row.deletedAt);
  }
  getCard(id: string) {
    return this.db.cards.get(id);
  }
  putCard(card: Dataset["cards"][number]) {
    return this.done(this.db.cards.put(card));
  }
  deleteCard(id: string) {
    return this.db.cards.delete(id);
  }
  listEvents() {
    return this.db.reviewEvents.toArray();
  }
  putEvent(event: Dataset["reviewEvents"][number]) {
    return this.done(this.db.reviewEvents.put(event));
  }
  deleteEvent(id: string) {
    return this.db.reviewEvents.delete(id);
  }
  listSessions() {
    return this.db.reviewSessions.toArray();
  }
  getSession(id: string) {
    return this.db.reviewSessions.get(id);
  }
  putSession(session: Dataset["reviewSessions"][number]) {
    return this.done(this.db.reviewSessions.put(session));
  }
  deleteSession(id: string) {
    return this.db.reviewSessions.delete(id);
  }
  listFocus() {
    return this.db.focusSessions.toArray();
  }
  putFocus(session: Dataset["focusSessions"][number]) {
    return this.done(this.db.focusSessions.put(session));
  }
  deleteFocus(id: string) {
    return this.db.focusSessions.delete(id);
  }
  async listAttachments(includeDeleted = false) {
    const rows = await this.db.attachments.toArray();
    return includeDeleted ? rows : rows.filter((row) => !row.deletedAt);
  }
  getAttachment(id: string) {
    return this.db.attachments.get(id);
  }
  putAttachment(attachment: Dataset["attachments"][number]) {
    return this.done(this.db.attachments.put(attachment));
  }
  deleteAttachment(id: string) {
    return this.db.attachments.delete(id);
  }
  async listPdfs(includeDeleted = false) {
    const rows = await this.db.pdfs.toArray();
    return includeDeleted ? rows : rows.filter((row) => !row.deletedAt);
  }
  getPdf(id: string) {
    return this.db.pdfs.get(id);
  }
  putPdf(pdf: Dataset["pdfs"][number]) {
    return this.done(this.db.pdfs.put(pdf));
  }
  deletePdf(id: string) {
    return this.db.pdfs.delete(id);
  }
  async listAnnotations(pdfId?: string) {
    const rows = pdfId ? await this.db.annotations.where("pdfId").equals(pdfId).toArray() : await this.db.annotations.toArray();
    return rows;
  }
  getAnnotation(id: string) {
    return this.db.annotations.get(id);
  }
  putAnnotation(annotation: Dataset["annotations"][number]) {
    return this.done(this.db.annotations.put(annotation));
  }
  deleteAnnotation(id: string) {
    return this.db.annotations.delete(id);
  }
  listTrash() {
    return this.db.trash.toArray();
  }
  getTrash(id: string) {
    return this.db.trash.get(id);
  }
  putTrash(item: Dataset["trash"][number]) {
    return this.done(this.db.trash.put(item));
  }
  deleteTrash(id: string) {
    return this.db.trash.delete(id);
  }

  async replaceAll(data: Dataset): Promise<void> {
    await this.transaction(async () => {
      await Promise.all([
        this.db.subjects.clear(),
        this.db.notes.clear(),
        this.db.drafts.clear(),
        this.db.links.clear(),
        this.db.cards.clear(),
        this.db.reviewEvents.clear(),
        this.db.reviewSessions.clear(),
        this.db.focusSessions.clear(),
        this.db.attachments.clear(),
        this.db.pdfs.clear(),
        this.db.annotations.clear(),
        this.db.trash.clear(),
        this.db.meta.clear(),
      ]);
      await this.insertDataset(data);
    });
  }

  async mergeMissing(data: Dataset): Promise<{ added: number; kept: number }> {
    let added = 0;
    let kept = 0;
    const count = async <T extends { id: string }>(rows: T[], existingIds: Set<string>, put: (row: T) => Promise<unknown>) => {
      for (const row of rows) {
        if (existingIds.has(row.id)) {
          kept += 1;
          continue;
        }
        await put(row);
        added += 1;
      }
    };
    await this.transaction(async () => {
      await count(data.subjects, new Set((await this.db.subjects.toArray()).map((row) => row.id)), (row) => this.db.subjects.put(row));
      await count(data.notes, new Set((await this.db.notes.toArray()).map((row) => row.id)), (row) => this.db.notes.put(row));
      await count(data.links, new Set((await this.db.links.toArray()).map((row) => row.id)), (row) => this.db.links.put(row));
      await count(data.cards, new Set((await this.db.cards.toArray()).map((row) => row.id)), (row) => this.db.cards.put(row));
      await count(data.reviewEvents, new Set((await this.db.reviewEvents.toArray()).map((row) => row.id)), (row) => this.db.reviewEvents.put(row));
      await count(data.reviewSessions, new Set((await this.db.reviewSessions.toArray()).map((row) => row.id)), (row) => this.db.reviewSessions.put(row));
      await count(data.focusSessions, new Set((await this.db.focusSessions.toArray()).map((row) => row.id)), (row) => this.db.focusSessions.put(row));
      await count(data.attachments, new Set((await this.db.attachments.toArray()).map((row) => row.id)), (row) => this.db.attachments.put(row));
      await count(data.pdfs, new Set((await this.db.pdfs.toArray()).map((row) => row.id)), (row) => this.db.pdfs.put(row));
      await count(data.annotations, new Set((await this.db.annotations.toArray()).map((row) => row.id)), (row) => this.db.annotations.put(row));
      await count(data.trash, new Set((await this.db.trash.toArray()).map((row) => row.id)), (row) => this.db.trash.put(row));
      if (!(await this.db.meta.get("app"))) await this.db.meta.put(data.meta);
      else kept += 1;
    });
    return { added, kept };
  }

  private async insertDataset(data: Dataset): Promise<void> {
    await this.db.subjects.bulkPut(data.subjects);
    await this.db.notes.bulkPut(data.notes);
    await this.db.links.bulkPut(data.links);
    await this.db.cards.bulkPut(data.cards);
    await this.db.reviewEvents.bulkPut(data.reviewEvents);
    await this.db.reviewSessions.bulkPut(data.reviewSessions);
    await this.db.focusSessions.bulkPut(data.focusSessions);
    await this.db.attachments.bulkPut(data.attachments);
    await this.db.pdfs.bulkPut(data.pdfs);
    await this.db.annotations.bulkPut(data.annotations);
    await this.db.trash.bulkPut(data.trash);
    await this.db.meta.put(data.meta);
  }
}

export async function exportDataset(repository: StudyRepository): Promise<Dataset> {
  const [subjects, notes, links, cards, reviewEvents, reviewSessions, focusSessions, attachments, pdfs, annotations, trash, meta] =
    await Promise.all([
      repository.listSubjects(true),
      repository.listNotes(true),
      repository.listLinks(),
      repository.listCards(true),
      repository.listEvents(),
      repository.listSessions(),
      repository.listFocus(),
      repository.listAttachments(true),
      repository.listPdfs(true),
      repository.listAnnotations(),
      repository.listTrash(),
      repository.getMeta(),
    ]);
  if (!meta) throw new Error("Os metadados do aplicativo não foram encontrados.");
  return { subjects, notes, links, cards, reviewEvents, reviewSessions, focusSessions, attachments, pdfs, annotations, trash, meta };
}
