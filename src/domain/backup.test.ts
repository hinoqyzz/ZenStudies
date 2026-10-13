import { describe, expect, it } from "vitest";
import { buildManifest, validateBackup } from "./backup";
import type { BackupData } from "./models";
import { openStack } from "../test/harness";

const createdAt = "2026-10-12T15:00:00.000Z";

describe("backup", () => {
  it("rejeita formato, versão e hash inválidos antes de aceitar os dados", async () => {
    const data = emptyData();
    const built = await buildManifest({ appVersion: "0.1.0", createdAt, data, files: [] });
    const valid = await validateBackup(JSON.stringify(built.manifest), built.dataJson);
    expect(valid.ok).toBe(true);

    const broken = await validateBackup(JSON.stringify({ ...built.manifest, format: "outro" }), built.dataJson);
    expect(broken.ok).toBe(false);

    const future = await validateBackup(JSON.stringify({ ...built.manifest, schemaVersion: 99 }), built.dataJson);
    expect(future.ok).toBe(false);

    const tampered = built.dataJson.replace("true", "false");
    const hash = await validateBackup(JSON.stringify(built.manifest), tampered);
    expect(hash.ok).toBe(false);
  });

  it("mescla sem apagar a nota atual e substituir só depois do backup de segurança", async () => {
    const stack = await openStack();
    const kept = await stack.services.notes.create({ title: "Minha nota", text: "real" });
    const exported = await stack.services.backup.export("memory/primeiro.zenbackup");
    expect(exported).toBe("memory/primeiro.zenbackup");
    await stack.services.notes.create({ title: "Depois", text: "nova" });

    const other = await openStack();
    const blob = stack.desktop.backups.get("memory/primeiro.zenbackup");
    if (!blob || !exported) throw new Error("backup ausente");
    other.desktop.backups.set(exported, blob);
    await other.services.notes.create({ title: "No outro lado", text: "fica" });
    const merged = await other.services.backup.merge("memory/primeiro.zenbackup");
    expect(merged.added).toBeGreaterThan(0);
    expect((await other.services.notes.list()).some((note) => note.title === "No outro lado")).toBe(true);
    expect((await other.services.notes.list()).some((note) => note.id === kept.id)).toBe(true);

    const replaced = await stack.services.backup.replace("memory/primeiro.zenbackup");
    expect(replaced.safetyPath).toContain("safety");
    const titles = (await stack.services.notes.list()).map((note) => note.title);
    expect(titles).toContain("Minha nota");
    expect(titles).not.toContain("Depois");
    other.close();
    stack.close();
  });

  it("não altera os dados quando o backup é inválido", async () => {
    const stack = await openStack();
    await stack.services.notes.create({ title: "Intacta", text: "permanece" });
    stack.desktop.backups.set("memory/ruim.zenbackup", {
      manifest: "{",
      data: "{",
      files: new Map(),
    });
    await expect(stack.services.backup.merge("memory/ruim.zenbackup")).rejects.toThrow();
    expect((await stack.services.notes.list()).map((note) => note.title)).toEqual(["Intacta"]);
    stack.close();
  });
});

function emptyData(): BackupData {
  return {
    subjects: [],
    notes: [],
    links: [],
    cards: [],
    reviewEvents: [],
    reviewSessions: [],
    focusSessions: [],
    attachments: [],
    pdfs: [],
    annotations: [],
    trash: [],
    meta: { id: "app", schemaVersion: 2, installedAt: createdAt, onboardingCompleted: true },
    preferences: {
      theme: "light",
      editorFontSize: 17,
      readingWidth: 720,
      motion: "full",
      focusMinutes: 25,
      reviewEnabled: false,
      reviewHour: 18,
      reviewMinute: 0,
      notificationsEnabled: false,
      notifyFocusEnd: true,
      notifyReviews: true,
      notifySaveFailure: true,
      closeToTray: false,
      startWithWindows: false,
    },
  };
}
