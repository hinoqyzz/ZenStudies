import { canonicalJson } from "./content";
import { isSafeRelativePath } from "./files";
import {
  BACKUP_FORMAT_VERSION,
  SCHEMA_VERSION,
  type BackupData,
  type BackupManifest,
} from "./models";

export interface BackupValidation {
  ok: true;
  manifest: BackupManifest;
  data: BackupData;
}

export interface BackupValidationFailure {
  ok: false;
  reason: string;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export async function buildManifest(input: {
  appVersion: string;
  createdAt: string;
  data: BackupData;
  files: BackupManifest["files"];
}): Promise<{ manifest: BackupManifest; dataJson: string }> {
  const dataJson = canonicalJson(input.data);
  const dataSha256 = await sha256Hex(encodeUtf8(dataJson));
  const manifest: BackupManifest = {
    format: "zenstudies-backup",
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: input.appVersion,
    schemaVersion: SCHEMA_VERSION,
    createdAt: input.createdAt,
    dataSha256,
    files: input.files,
  };
  return { manifest, dataJson };
}

export async function validateBackup(manifestRaw: string, dataRaw: string): Promise<BackupValidation | BackupValidationFailure> {
  let manifest: BackupManifest;
  let data: BackupData;
  try {
    manifest = JSON.parse(manifestRaw) as BackupManifest;
    data = JSON.parse(dataRaw) as BackupData;
  } catch {
    return { ok: false, reason: "O backup não é um JSON válido." };
  }
  if (manifest.format !== "zenstudies-backup") return { ok: false, reason: "O formato do backup não é do ZenStudies." };
  if (manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    return { ok: false, reason: "A versão do formato de backup não é compatível." };
  }
  if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion > SCHEMA_VERSION || manifest.schemaVersion < 1) {
    return { ok: false, reason: "A versão do schema do backup não é compatível." };
  }
  const actual = await sha256Hex(encodeUtf8(canonicalJson(data)));
  if (actual !== manifest.dataSha256) return { ok: false, reason: "A integridade dos dados do backup falhou." };
  if (!Array.isArray(manifest.files) || !Array.isArray(data.notes) || !data.meta) {
    return { ok: false, reason: "O backup está incompleto." };
  }
  for (const file of manifest.files) {
    if (!isSafeRelativePath(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256) || file.bytes < 0) {
      return { ok: false, reason: "O backup contém um arquivo com caminho ou hash inválido." };
    }
  }
  const paths = new Set(manifest.files.map((file) => file.path));
  const referenced = [
    ...data.attachments.map((item) => item.relativePath),
    ...data.pdfs.map((item) => item.relativePath),
  ];
  for (const path of referenced) {
    if (!paths.has(path)) return { ok: false, reason: `Falta o arquivo ${path} no backup.` };
  }
  return { ok: true, manifest, data };
}
