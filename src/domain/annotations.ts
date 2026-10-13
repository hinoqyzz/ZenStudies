import type { AnnotationType, NormPoint, NormRect, PdfAnnotation } from "./models";

export const HIGHLIGHT_COLORS = ["#6558E8", "#73D8B2", "#101C1A"] as const;

export function clampUnit(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function normalizeRect(rect: NormRect): NormRect | null {
  const x = clampUnit(rect.x);
  const y = clampUnit(rect.y);
  const w = clampUnit(rect.w);
  const h = clampUnit(rect.h);
  if (w <= 0.001 || h <= 0.001) return null;
  return {
    x,
    y,
    w: Math.min(w, 1 - x),
    h: Math.min(h, 1 - y),
  };
}

export function normalizePoints(points: NormPoint[]): NormPoint[] {
  return points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: clampUnit(point.x), y: clampUnit(point.y) }));
}

export function isHighlightColor(color: string): boolean {
  return (HIGHLIGHT_COLORS as readonly string[]).includes(color);
}

export function annotationIsValid(annotation: Pick<PdfAnnotation, "type" | "page" | "color" | "rects" | "points">): boolean {
  if (!Number.isInteger(annotation.page) || annotation.page < 1) return false;
  if (!isHighlightColor(annotation.color)) return false;
  if (annotation.type === "freehand") return normalizePoints(annotation.points).length >= 2;
  if (annotation.type === "comment") return annotation.rects.length === 1 && normalizeRect(annotation.rects[0]) !== null;
  return annotation.rects.some((rect) => normalizeRect(rect) !== null);
}

export function serializeAnnotation(annotation: PdfAnnotation): string {
  return JSON.stringify(annotation);
}

export function restoreAnnotation(raw: string): PdfAnnotation {
  const parsed = JSON.parse(raw) as PdfAnnotation;
  if (!parsed || typeof parsed !== "object") throw new Error("Marcação inválida.");
  const type = parsed.type as AnnotationType;
  if (!["highlight", "underline", "comment", "freehand"].includes(type)) throw new Error("Tipo de marcação inválido.");
  const rects = (parsed.rects ?? []).map(normalizeRect).filter((rect): rect is NormRect => rect !== null);
  const points = normalizePoints(parsed.points ?? []);
  const restored: PdfAnnotation = {
    ...parsed,
    type,
    rects,
    points,
    color: isHighlightColor(parsed.color) ? parsed.color : HIGHLIGHT_COLORS[0],
  };
  if (!annotationIsValid(restored)) throw new Error("A marcação não pôde ser restaurada.");
  return restored;
}
