import { describe, expect, it } from "vitest";
import type { PdfAnnotation } from "./models";
import { restoreAnnotation, serializeAnnotation } from "./annotations";

describe("marcações de PDF", () => {
  it("serializa e restaura retângulos, texto e cor da paleta", () => {
    const annotation: PdfAnnotation = {
      id: "ann-1",
      pdfId: "pdf-1",
      page: 2,
      type: "highlight",
      color: "#6558E8",
      rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.05 }],
      points: [],
      selectedText: "membrana plasmática",
      comment: null,
      author: "local",
      noteId: null,
      cardId: null,
      createdAt: "2026-10-12T15:00:00.000Z",
      updatedAt: "2026-10-12T15:00:00.000Z",
      deletedAt: null,
      revision: 1,
    };
    const restored = restoreAnnotation(serializeAnnotation(annotation));
    expect(restored).toEqual(annotation);
  });

  it("recusa marcação incompleta e normaliza coordenadas", () => {
    const raw = JSON.stringify({
      id: "ann-2",
      pdfId: "pdf-1",
      page: 1,
      type: "freehand",
      color: "#ff00ff",
      rects: [],
      points: [{ x: -2, y: 0.5 }, { x: 1.4, y: 0.8 }],
      selectedText: null,
      comment: null,
      author: "local",
      noteId: null,
      cardId: null,
      createdAt: "2026-10-12T15:00:00.000Z",
      updatedAt: "2026-10-12T15:00:00.000Z",
      deletedAt: null,
      revision: 1,
    });
    const restored = restoreAnnotation(raw);
    expect(restored.color).toBe("#6558E8");
    expect(restored.points).toEqual([{ x: 0, y: 0.5 }, { x: 1, y: 0.8 }]);
    expect(() => restoreAnnotation(JSON.stringify({ ...JSON.parse(raw), type: "highlight", points: [], rects: [] }))).toThrow(/não pôde ser restaurada/);
  });
});
