export interface StoredFile {
  relativePath: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  extension: string;
  originalName: string;
}

export interface BackupInspection {
  manifest: string;
  data: string;
}

export interface DesktopGateway {
  kind: "tauri" | "browser";
  pickOpen(filters: { name: string; extensions: string[] }[]): Promise<string | null>;
  pickSave(defaultName: string): Promise<string | null>;
  importPath(path: string, kind: "image" | "audio" | "pdf"): Promise<StoredFile>;
  importBytes(name: string, bytes: Uint8Array, kind: "image" | "audio" | "pdf"): Promise<StoredFile>;
  read(relativePath: string): Promise<Uint8Array>;
  exists(relativePath: string): Promise<boolean>;
  remove(relativePath: string): Promise<void>;
  open(relativePath: string): Promise<void>;
  writeBackup(destination: string, manifest: string, data: string, relativePaths: string[]): Promise<void>;
  inspectBackup(path: string): Promise<BackupInspection>;
  restoreBackupFiles(path: string): Promise<void>;
  safetyBackupPath(): Promise<string>;
  pruneStorage(keep: string[]): Promise<void>;
  notify(title: string, body: string): Promise<void>;
  notificationPermission(): Promise<"granted" | "denied" | "prompt" | "unsupported">;
  requestNotificationPermission(): Promise<"granted" | "denied" | "unsupported">;
  setCloseToTray(value: boolean): Promise<void>;
  setAutostart(value: boolean): Promise<void>;
  autostartEnabled(): Promise<boolean>;
  hideMain(): Promise<void>;
  showMain(): Promise<void>;
  quit(): Promise<void>;
  openWindow(spec: { label: string; route: string; title: string; width: number; height: number }): Promise<void>;
  onCloseRequested(handler: () => void): Promise<() => void>;
  onQuitRequested(handler: () => void): Promise<() => void>;
  onTrayAction(handler: (action: string) => void): Promise<() => void>;
  publish(event: unknown): Promise<void>;
  onSync(handler: (event: unknown) => void): Promise<() => void>;
  isMainVisible(): Promise<boolean>;
  currentLabel(): Promise<string>;
  closeCurrent(): Promise<void>;
  onFileDrop(handler: (paths: string[]) => void): Promise<() => void>;
}

export function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  if (Array.isArray(data)) return Uint8Array.from(data);
  throw new Error("formato de arquivo inesperado");
}
