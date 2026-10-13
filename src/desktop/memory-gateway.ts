import { inspectFile, isSafeRelativePath } from "../domain/files";
import { createId } from "../domain/ids";
import { sha256Hex } from "../domain/backup";
import type { BackupInspection, DesktopGateway, StoredFile } from "./gateway";

interface BackupBlob {
  manifest: string;
  data: string;
  files: Map<string, Uint8Array>;
}

export class MemoryGateway implements DesktopGateway {
  readonly kind = "browser" as const;
  readonly files = new Map<string, Uint8Array>();
  readonly backups = new Map<string, BackupBlob>();
  closeRequests = 0;
  quitRequests = 0;
  notifications: { title: string; body: string }[] = [];
  permission: "prompt" | "granted" | "denied" = "prompt";
  closeToTray = false;
  autostart = false;
  visible = true;
  windows: string[] = ["main"];

  async pickOpen(): Promise<string | null> {
    return null;
  }

  async pickSave(defaultName: string): Promise<string | null> {
    return `memory/${defaultName}`;
  }

  async importPath(path: string, kind: "image" | "audio" | "pdf"): Promise<StoredFile> {
    const bytes = this.files.get(path);
    if (!bytes) throw new Error("Arquivo ausente.");
    return this.importBytes(path.split("/").pop() ?? "arquivo", bytes, kind);
  }

  async importBytes(name: string, bytes: Uint8Array, kind: "image" | "audio" | "pdf"): Promise<StoredFile> {
    const inspected = inspectFile(name, bytes, kind);
    if (!inspected.ok) throw new Error(inspected.reason);
    const relativePath = `${kind === "pdf" ? "pdfs" : "attachments"}/${createId()}.${inspected.extension}`;
    const copy = new Uint8Array(bytes);
    this.files.set(relativePath, copy);
    return {
      relativePath,
      sha256: await sha256Hex(copy),
      sizeBytes: copy.byteLength,
      mimeType: inspected.mimeType,
      extension: inspected.extension,
      originalName: name,
    };
  }

  async read(relativePath: string): Promise<Uint8Array> {
    this.assertRelative(relativePath);
    const bytes = this.files.get(relativePath);
    if (!bytes) throw new Error("Arquivo ausente.");
    return bytes;
  }

  async exists(relativePath: string): Promise<boolean> {
    return isSafeRelativePath(relativePath) && this.files.has(relativePath);
  }

  async remove(relativePath: string): Promise<void> {
    this.assertRelative(relativePath);
    this.files.delete(relativePath);
  }

  async open(relativePath: string): Promise<void> {
    if (!(await this.exists(relativePath))) throw new Error("Arquivo ausente.");
  }

  async writeBackup(destination: string, manifest: string, data: string, relativePaths: string[]): Promise<void> {
    const files = new Map<string, Uint8Array>();
    for (const path of relativePaths) {
      const bytes = await this.read(path);
      files.set(path, bytes);
    }
    this.backups.set(destination, { manifest, data, files });
  }

  async inspectBackup(path: string): Promise<BackupInspection> {
    const backup = this.backups.get(path);
    if (!backup) throw new Error("Backup não encontrado.");
    const manifest = JSON.parse(backup.manifest) as { dataSha256: string; files: { path: string; sha256: string; bytes: number }[] };
    const dataHash = await sha256Hex(new TextEncoder().encode(backup.data));
    if (dataHash !== manifest.dataSha256) throw new Error("A integridade dos dados do backup falhou.");
    for (const file of manifest.files) {
      const bytes = backup.files.get(file.path);
      if (!bytes || bytes.byteLength !== file.bytes || (await sha256Hex(bytes)) !== file.sha256) {
        throw new Error("A integridade de um arquivo do backup falhou.");
      }
    }
    return { manifest: backup.manifest, data: backup.data };
  }

  async safetyBackupPath(): Promise<string> {
    return `memory/safety-${createId()}.zenbackup`;
  }

  async pruneStorage(keep: string[]): Promise<void> {
    const allowed = new Set(keep);
    for (const path of [...this.files.keys()]) {
      if (!allowed.has(path) && isSafeRelativePath(path)) this.files.delete(path);
    }
  }

  async restoreBackupFiles(path: string): Promise<void> {
    const backup = this.backups.get(path);
    if (!backup) throw new Error("Backup não encontrado.");
    for (const [relative, bytes] of backup.files) this.files.set(relative, bytes);
  }

  async notify(title: string, body: string): Promise<void> {
    if (this.permission !== "granted") return;
    this.notifications.push({ title, body });
  }

  async notificationPermission() {
    return this.permission;
  }

  async requestNotificationPermission() {
    if (this.permission === "prompt") this.permission = "granted";
    return this.permission === "granted" ? "granted" : "denied";
  }

  async setCloseToTray(value: boolean) {
    this.closeToTray = value;
  }

  async setAutostart(value: boolean) {
    this.autostart = value;
  }

  async autostartEnabled() {
    return this.autostart;
  }

  async hideMain() {
    this.visible = false;
  }

  async showMain() {
    this.visible = true;
  }

  async quit() {
    this.quitRequests += 1;
  }

  async openWindow(spec: { label: string }) {
    if (!this.windows.includes(spec.label)) this.windows.push(spec.label);
  }

  async onCloseRequested() {
    return () => undefined;
  }

  async onQuitRequested() {
    return () => undefined;
  }

  async onTrayAction() {
    return () => undefined;
  }

  async publish() {
    return undefined;
  }

  async onSync() {
    return () => undefined;
  }

  async isMainVisible() {
    return this.visible;
  }

  async currentLabel() {
    return "main";
  }

  async closeCurrent() {
    return undefined;
  }

  async onFileDrop() {
    return () => undefined;
  }

  private assertRelative(path: string) {
    if (!isSafeRelativePath(path)) throw new Error("Caminho interno inválido.");
  }
}
