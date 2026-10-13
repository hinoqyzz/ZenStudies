import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { open, save } from "@tauri-apps/plugin-dialog";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { toBytes, type BackupInspection, type DesktopGateway, type StoredFile } from "./gateway";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function createTauriGateway(): DesktopGateway {
  return {
    kind: "tauri",
    async pickOpen(filters) {
      const selected = await open({ multiple: false, directory: false, filters });
      return typeof selected === "string" ? selected : null;
    },
    async pickSave(defaultName) {
      return save({ defaultPath: defaultName, filters: [{ name: "Backup ZenStudies", extensions: ["zenbackup"] }] });
    },
    importPath: (path, kind) => invoke<StoredFile>("import_path", { path, kind }),
    importBytes: (name, bytes, kind) => invoke<StoredFile>("import_bytes", { name, bytes: Array.from(bytes), kind }),
    async read(relativePath) {
      return toBytes(await invoke("read_managed", { relativePath }));
    },
    exists: (relativePath) => invoke<boolean>("exists_managed", { relativePath }),
    remove: (relativePath) => invoke("remove_managed", { relativePath }),
    open: (relativePath) => invoke("open_managed", { relativePath }),
    writeBackup: (destination, manifest, data, relativePaths) => invoke("write_backup", { destination, manifest, data, relativePaths }),
    inspectBackup: (path) => invoke<BackupInspection>("inspect_backup", { path }),
    restoreBackupFiles: (path) => invoke("restore_backup_files", { path }),
    safetyBackupPath: () => invoke<string>("safety_backup_path"),
    pruneStorage: (keep) => invoke("prune_storage", { keep }),
    async notify(title, body) {
      const granted = await isPermissionGranted();
      if (!granted) return;
      sendNotification({ title, body });
    },
    async notificationPermission() {
      return (await isPermissionGranted()) ? "granted" : "prompt";
    },
    async requestNotificationPermission() {
      const permission = await requestPermission();
      return permission === "granted" ? "granted" : "denied";
    },
    async setCloseToTray() {
      return undefined;
    },
    async setAutostart(value) {
      if (value) await enable();
      else await disable();
    },
    autostartEnabled: () => isEnabled(),
    hideMain: () => invoke("hide_main"),
    showMain: () => invoke("show_main_window"),
    quit: () => invoke("quit_app"),
    openWindow: (spec) => invoke("open_window", { spec }),
    async onCloseRequested(handler) {
      return listen("app://close-requested", () => handler());
    },
    async onQuitRequested(handler) {
      return listen("tray://action", (event) => {
        if (event.payload === "quit") handler();
      });
    },
    async onTrayAction(handler) {
      return listen<string>("tray://action", (event) => handler(event.payload));
    },
    publish: (event) => invoke("publish_sync", { event }),
    async onSync(handler) {
      return listen("app://sync", (event) => handler(event.payload));
    },
    isMainVisible: () => invoke<boolean>("is_main_visible"),
    async currentLabel() {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      return getCurrentWindow().label;
    },
    async closeCurrent() {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    },
    async onFileDrop(handler) {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      return getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type === "drop") handler(event.payload.paths);
      });
    },
  };
}
