export const FILE_LIMITS = {
  imageBytes: 25 * 1024 * 1024,
  audioBytes: 50 * 1024 * 1024,
  pdfBytes: 200 * 1024 * 1024,
} as const;

export type ManagedKind = "image" | "audio" | "pdf";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "m4a"]);
const PDF_EXT = new Set(["pdf"]);

export interface FileInspection {
  ok: true;
  kind: ManagedKind;
  extension: string;
  mimeType: string;
}

export interface FileRejection {
  ok: false;
  reason: string;
}

export function extensionOf(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function inspectFile(name: string, bytes: Uint8Array, hintedKind?: ManagedKind): FileInspection | FileRejection {
  const extension = extensionOf(name);
  const kind = kindFromExtension(extension);
  if (!kind) return { ok: false, reason: "Tipo de arquivo não aceito. Use PDF, imagem ou áudio." };
  if (hintedKind && hintedKind !== kind) return { ok: false, reason: "A extensão não corresponde ao tipo esperado." };
  const limit = kind === "pdf" ? FILE_LIMITS.pdfBytes : kind === "image" ? FILE_LIMITS.imageBytes : FILE_LIMITS.audioBytes;
  if (bytes.byteLength === 0) return { ok: false, reason: "O arquivo está vazio." };
  if (bytes.byteLength > limit) return { ok: false, reason: "O arquivo excede o tamanho permitido." };
  if (!magicMatches(kind, extension, bytes)) {
    return { ok: false, reason: "O conteúdo do arquivo não corresponde à extensão." };
  }
  return { ok: true, kind, extension: extension === "jpeg" ? "jpg" : extension, mimeType: mimeFor(kind, extension) };
}

export function isSafeRelativePath(path: string): boolean {
  if (!path || path.length > 240) return false;
  if (path.includes("..") || path.includes("\\") || path.startsWith("/") || path.includes(":")) return false;
  return /^(attachments|pdfs)\/[a-z0-9-]+\.(png|jpg|gif|webp|mp3|wav|ogg|m4a|pdf)$/i.test(path);
}

function kindFromExtension(extension: string): ManagedKind | null {
  if (IMAGE_EXT.has(extension)) return "image";
  if (AUDIO_EXT.has(extension)) return "audio";
  if (PDF_EXT.has(extension)) return "pdf";
  return null;
}

function mimeFor(kind: ManagedKind, extension: string): string {
  if (kind === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "wav") return "audio/wav";
  if (extension === "ogg") return "audio/ogg";
  if (extension === "m4a") return "audio/mp4";
  return "application/octet-stream";
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function magicMatches(kind: ManagedKind, extension: string, bytes: Uint8Array): boolean {
  if (kind === "pdf") return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]);
  if (extension === "png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
  if (extension === "jpg" || extension === "jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (extension === "gif") return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]);
  if (extension === "webp") return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && asciiAt(bytes, 8, "WEBP");
  if (extension === "wav") return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && asciiAt(bytes, 8, "WAVE");
  if (extension === "ogg") return startsWith(bytes, [0x4f, 0x67, 0x67, 0x53]);
  if (extension === "mp3") return startsWith(bytes, [0x49, 0x44, 0x33]) || (bytes.length > 1 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (extension === "m4a") return asciiAt(bytes, 4, "ftyp");
  return false;
}

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}
