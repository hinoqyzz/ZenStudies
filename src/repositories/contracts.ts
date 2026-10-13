import type {
  AppMeta,
  Attachment,
  BackupData,
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
} from "../domain/models";

export interface StudyRepository {
  transaction<T>(work: () => Promise<T>): Promise<T>;
  getMeta(): Promise<AppMeta | undefined>;
  putMeta(meta: AppMeta): Promise<void>;
  listSubjects(includeDeleted?: boolean): Promise<Subject[]>;
  getSubject(id: string): Promise<Subject | undefined>;
  putSubject(subject: Subject): Promise<void>;
  deleteSubject(id: string): Promise<void>;
  listNotes(includeDeleted?: boolean): Promise<Note[]>;
  getNote(id: string): Promise<Note | undefined>;
  putNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;
  getDraft(noteId: string): Promise<NoteDraft | undefined>;
  putDraft(draft: NoteDraft): Promise<void>;
  deleteDraft(noteId: string): Promise<void>;
  listLinks(): Promise<NoteLink[]>;
  putLink(link: NoteLink): Promise<void>;
  deleteLink(id: string): Promise<void>;
  listCards(includeDeleted?: boolean): Promise<Card[]>;
  getCard(id: string): Promise<Card | undefined>;
  putCard(card: Card): Promise<void>;
  deleteCard(id: string): Promise<void>;
  listEvents(): Promise<ReviewEvent[]>;
  putEvent(event: ReviewEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  listSessions(): Promise<ReviewSession[]>;
  getSession(id: string): Promise<ReviewSession | undefined>;
  putSession(session: ReviewSession): Promise<void>;
  deleteSession(id: string): Promise<void>;
  listFocus(): Promise<FocusSession[]>;
  putFocus(session: FocusSession): Promise<void>;
  deleteFocus(id: string): Promise<void>;
  listAttachments(includeDeleted?: boolean): Promise<Attachment[]>;
  getAttachment(id: string): Promise<Attachment | undefined>;
  putAttachment(attachment: Attachment): Promise<void>;
  deleteAttachment(id: string): Promise<void>;
  listPdfs(includeDeleted?: boolean): Promise<PdfDocument[]>;
  getPdf(id: string): Promise<PdfDocument | undefined>;
  putPdf(pdf: PdfDocument): Promise<void>;
  deletePdf(id: string): Promise<void>;
  listAnnotations(pdfId?: string): Promise<PdfAnnotation[]>;
  getAnnotation(id: string): Promise<PdfAnnotation | undefined>;
  putAnnotation(annotation: PdfAnnotation): Promise<void>;
  deleteAnnotation(id: string): Promise<void>;
  listTrash(): Promise<TrashItem[]>;
  getTrash(id: string): Promise<TrashItem | undefined>;
  putTrash(item: TrashItem): Promise<void>;
  deleteTrash(id: string): Promise<void>;
  replaceAll(data: Omit<BackupData, "preferences">): Promise<void>;
  mergeMissing(data: Omit<BackupData, "preferences">): Promise<{ added: number; kept: number }>;
}
