export type Origin = "user" | "demo";

export type IsoDateTime = string;

export interface RichMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface RichContent {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: RichMark[];
  content?: RichContent[];
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  revision: number;
  origin: Origin;
}

export type NoteStatus = "draft" | "studying" | "archived";

export interface Note {
  id: string;
  subjectId: string | null;
  title: string;
  content: RichContent;
  text: string;
  pinned: boolean;
  status: NoteStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  revision: number;
  origin: Origin;
}

export interface NoteDraft {
  id: string;
  noteId: string;
  title: string;
  content: RichContent;
  text: string;
  baseRevision: number;
  updatedAt: IsoDateTime;
}

export type LinkSource = "editor" | "manual";

export interface NoteLink {
  id: string;
  fromNoteId: string;
  toNoteId: string;
  source: LinkSource;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  revision: number;
  origin: Origin;
}

export type IntervalUnit = "minutes" | "hours" | "days";

export type CardState = "active" | "suspended" | "archived";

export interface Card {
  id: string;
  noteId: string;
  subjectId: string | null;
  subjectName: string;
  question: string;
  answer: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  revision: number;
  lastReviewedAt: IsoDateTime | null;
  nextReviewAt: IsoDateTime;
  currentInterval: number;
  intervalUnit: IntervalUnit;
  difficulty: number;
  correctCount: number;
  incorrectCount: number;
  state: CardState;
  origin: Origin;
  sourcePdfId: string | null;
  sourcePage: number | null;
  sourceAnnotationId: string | null;
}

export type ReviewResponse = "again" | "hard" | "good";

export interface ScheduleSnapshot {
  currentInterval: number;
  intervalUnit: IntervalUnit;
  difficulty: number;
  correctCount: number;
  incorrectCount: number;
  nextReviewAt: IsoDateTime;
  lastReviewedAt: IsoDateTime | null;
  state: CardState;
}

export interface ReviewEvent {
  id: string;
  cardId: string;
  sessionId: string;
  previous: ScheduleSnapshot;
  response: ReviewResponse;
  resulting: ScheduleSnapshot;
  reviewedAt: IsoDateTime;
}

export type ReviewSessionStatus = "active" | "completed";

export interface SessionResponse {
  cardId: string;
  response: ReviewResponse;
  at: IsoDateTime;
  eventId: string;
}

export interface ReviewSession {
  id: string;
  startedAt: IsoDateTime;
  updatedAt: IsoDateTime;
  completedAt: IsoDateTime | null;
  cardIds: string[];
  position: number;
  responses: SessionResponse[];
  status: ReviewSessionStatus;
}

export type FocusStatus = "active" | "completed" | "cancelled";

export interface FocusSession {
  id: string;
  noteId: string | null;
  subjectId: string | null;
  title: string;
  plannedMinutes: number;
  startedAt: IsoDateTime;
  endedAt: IsoDateTime | null;
  status: FocusStatus;
  revision: number;
}

export type AttachmentKind = "image" | "audio";

export interface Attachment {
  id: string;
  noteId: string | null;
  kind: AttachmentKind;
  originalName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  relativePath: string;
  sha256: string;
  alt: string;
  caption: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  revision: number;
  origin: Origin;
}

export interface PdfDocument {
  id: string;
  subjectId: string | null;
  title: string;
  originalName: string;
  relativePath: string;
  mimeType: "application/pdf";
  sizeBytes: number;
  pageCount: number;
  progressPage: number;
  lastOpenedAt: IsoDateTime | null;
  bookmarkPage: number | null;
  sha256: string;
  textLayerAvailable: boolean | null;
  protected: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  revision: number;
  origin: Origin;
}

export type AnnotationType = "highlight" | "underline" | "comment" | "freehand";

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NormPoint {
  x: number;
  y: number;
}

export interface PdfAnnotation {
  id: string;
  pdfId: string;
  page: number;
  type: AnnotationType;
  color: string;
  rects: NormRect[];
  points: NormPoint[];
  selectedText: string | null;
  comment: string | null;
  author: string;
  noteId: string | null;
  cardId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  revision: number;
}

export type TrashEntityType = "note" | "card" | "subject" | "pdf" | "attachment";

export interface TrashSnapshot {
  linkIds: string[];
  cardIds: string[];
  annotationIds: string[];
}

export interface TrashItem {
  id: string;
  entityType: TrashEntityType;
  entityId: string;
  title: string;
  deletedAt: IsoDateTime;
  snapshot: TrashSnapshot;
  origin: Origin;
}

export interface AppMeta {
  id: "app";
  schemaVersion: number;
  installedAt: IsoDateTime;
  onboardingCompleted: boolean;
}

export interface BackupFileEntry {
  path: string;
  sha256: string;
  bytes: number;
}

export interface BackupManifest {
  format: "zenstudies-backup";
  formatVersion: number;
  appVersion: string;
  schemaVersion: number;
  createdAt: IsoDateTime;
  dataSha256: string;
  files: BackupFileEntry[];
}

export interface BackupPreferences {
  theme: "light" | "dark" | "system";
  editorFontSize: number;
  readingWidth: number;
  motion: "full" | "reduced" | "off";
  focusMinutes: number;
  reviewEnabled: boolean;
  reviewHour: number;
  reviewMinute: number;
  notificationsEnabled: boolean;
  notifyFocusEnd: boolean;
  notifyReviews: boolean;
  notifySaveFailure: boolean;
  closeToTray: boolean;
  startWithWindows: boolean;
}

export interface BackupData {
  subjects: Subject[];
  notes: Note[];
  links: NoteLink[];
  cards: Card[];
  reviewEvents: ReviewEvent[];
  reviewSessions: ReviewSession[];
  focusSessions: FocusSession[];
  attachments: Attachment[];
  pdfs: PdfDocument[];
  annotations: PdfAnnotation[];
  trash: TrashItem[];
  meta: AppMeta;
  preferences: BackupPreferences;
}

export const SCHEMA_VERSION = 2;
export const BACKUP_FORMAT_VERSION = 1;
export const EMPTY_SNAPSHOT: TrashSnapshot = {
  linkIds: [],
  cardIds: [],
  annotationIds: [],
};
