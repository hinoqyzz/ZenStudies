import { describe, expect, it } from "vitest";
import { describePersistenceError } from "./errors";
import { inspectFile, isSafeRelativePath } from "./files";
import { openStack, pdfBytes, pngBytes } from "../test/harness";

describe("metadados de arquivos", () => {
  it("aceita imagem e PDF válidos e recusa caminho ou tipo inseguro", () => {
    const image = inspectFile("foto.png", pngBytes(), "image");
    expect(image.ok && image.extension).toBe("png");
    const pdf = inspectFile("aula.pdf", pdfBytes(), "pdf");
    expect(pdf.ok && pdf.mimeType).toBe("application/pdf");
    expect(inspectFile("virus.exe", pngBytes()).ok).toBe(false);
    expect(inspectFile("foto.png", new Uint8Array([1, 2, 3]), "image").ok).toBe(false);
    expect(isSafeRelativePath("attachments/abc.png")).toBe(true);
    expect(isSafeRelativePath("attachments/../segredo.png")).toBe(false);
    expect(isSafeRelativePath("C:/attachments/abc.png")).toBe(false);
    expect(isSafeRelativePath("attachments/11111111-1111-1111-1111-111111111111.png")).toBe(true);
  });

  it("guarda só metadados e o caminho relativo do anexo", async () => {
    const stack = await openStack();
    const note = await stack.services.notes.create({ title: "Com imagem", text: "texto" });
    const attachment = await stack.services.attachments.importBytes(note.id, "celula.png", pngBytes(), "image");
    expect(attachment.noteId).toBe(note.id);
    expect(attachment.kind).toBe("image");
    expect(attachment.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(attachment.relativePath.startsWith("attachments/")).toBe(true);
    expect(attachment.relativePath.includes("celula")).toBe(false);
    const bytes = await stack.services.attachments.read(attachment.id);
    expect(bytes[0]).toBe(0x89);
    stack.desktop.files.delete(attachment.relativePath);
    await expect(stack.services.attachments.read(attachment.id)).rejects.toThrow(/ausente/);
    expect(describePersistenceError(new Error("Arquivo ausente."))).toMatch(/não foi encontrado/);
    stack.close();
  });
});
