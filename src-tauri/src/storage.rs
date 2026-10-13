use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

pub const IMAGE_LIMIT: u64 = 25 * 1024 * 1024;
pub const AUDIO_LIMIT: u64 = 50 * 1024 * 1024;
pub const PDF_LIMIT: u64 = 200 * 1024 * 1024;
const MAX_ZIP_FILES: usize = 5_000;
const MAX_ZIP_BYTES: u64 = 2 * 1024 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ManagedKind {
    Image,
    Audio,
    Pdf,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredFile {
    pub relative_path: String,
    pub sha256: String,
    pub size_bytes: u64,
    pub mime_type: String,
    pub extension: String,
    pub original_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestFile {
    path: String,
    sha256: String,
    bytes: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    #[serde(rename = "dataSha256")]
    #[allow(dead_code)]
    data_sha256: String,
    files: Vec<ManifestFile>,
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

pub fn safe_relative(value: &str) -> Result<String, String> {
    if value.len() > 240 || value.contains("..") || value.contains('\\') || value.contains(':') || value.starts_with('/') {
        return Err("Caminho interno inválido.".into());
    }
    let ok = value.starts_with("attachments/") || value.starts_with("pdfs/");
    if !ok || value.matches('/').count() != 1 {
        return Err("Caminho interno inválido.".into());
    }
    Ok(value.to_string())
}

pub fn join_storage(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let relative = safe_relative(relative)?;
    let path = root.join(&relative);
    let root_canon = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    if path.exists() {
        let canon = path.canonicalize().map_err(|error| error.to_string())?;
        if !canon.starts_with(&root_canon) {
            return Err("Caminho fora do armazenamento do aplicativo.".into());
        }
    }
    Ok(path)
}

pub fn original_name(name: &str) -> String {
    let base = Path::new(name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("arquivo");
    let cleaned: String = base.chars().filter(|char| !char.is_control()).take(180).collect();
    let trimmed = cleaned.trim_start_matches('.').trim();
    if trimmed.is_empty() { "arquivo".into() } else { trimmed.into() }
}

pub fn classify(name: &str, bytes: &[u8], hinted: Option<&str>) -> Result<(ManagedKind, String, String), String> {
    let extension = Path::new(name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let (kind, extension, mime) = match extension.as_str() {
        "png" if starts(bytes, &[0x89, 0x50, 0x4E, 0x47]) => (ManagedKind::Image, "png", "image/png"),
        "jpg" | "jpeg" if starts(bytes, &[0xFF, 0xD8, 0xFF]) => (ManagedKind::Image, "jpg", "image/jpeg"),
        "gif" if starts(bytes, &[0x47, 0x49, 0x46, 0x38]) => (ManagedKind::Image, "gif", "image/gif"),
        "webp" if starts(bytes, b"RIFF") && ascii_at(bytes, 8, b"WEBP") => (ManagedKind::Image, "webp", "image/webp"),
        "mp3" if starts(bytes, b"ID3") || (bytes.len() > 1 && bytes[0] == 0xFF && bytes[1] & 0xE0 == 0xE0) => {
            (ManagedKind::Audio, "mp3", "audio/mpeg")
        }
        "wav" if starts(bytes, b"RIFF") && ascii_at(bytes, 8, b"WAVE") => (ManagedKind::Audio, "wav", "audio/wav"),
        "ogg" if starts(bytes, b"OggS") => (ManagedKind::Audio, "ogg", "audio/ogg"),
        "m4a" if ascii_at(bytes, 4, b"ftyp") => (ManagedKind::Audio, "m4a", "audio/mp4"),
        "pdf" if starts(bytes, b"%PDF") => (ManagedKind::Pdf, "pdf", "application/pdf"),
        _ => return Err("Tipo de arquivo não aceito ou conteúdo diferente da extensão.".into()),
    };
    if let Some(hint) = hinted {
        let expected = match hint {
            "image" => ManagedKind::Image,
            "audio" => ManagedKind::Audio,
            "pdf" => ManagedKind::Pdf,
            _ => return Err("Tipo esperado desconhecido.".into()),
        };
        if expected != kind {
            return Err("A extensão não corresponde ao tipo esperado.".into());
        }
    }
    let limit = match kind {
        ManagedKind::Image => IMAGE_LIMIT,
        ManagedKind::Audio => AUDIO_LIMIT,
        ManagedKind::Pdf => PDF_LIMIT,
    };
    if bytes.is_empty() {
        return Err("O arquivo está vazio.".into());
    }
    if bytes.len() as u64 > limit {
        return Err("O arquivo excede o tamanho permitido.".into());
    }
    Ok((kind, extension.to_string(), mime.to_string()))
}

pub fn store_bytes(root: &Path, name: &str, bytes: &[u8], hinted: Option<&str>) -> Result<StoredFile, String> {
    let (_kind, extension, mime) = classify(name, bytes, hinted)?;
    let folder = if extension == "pdf" { "pdfs" } else { "attachments" };
    let relative = format!("{folder}/{}.{}", uuid::Uuid::new_v4(), extension);
    let destination = join_storage(root, &relative)?;
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&destination, bytes).map_err(|error| error.to_string())?;
    Ok(StoredFile {
        relative_path: relative,
        sha256: sha256_hex(bytes),
        size_bytes: bytes.len() as u64,
        mime_type: mime,
        extension,
        original_name: original_name(name),
    })
}

pub fn read_stored(root: &Path, relative: &str) -> Result<Vec<u8>, String> {
    let path = join_storage(root, relative)?;
    fs::read(&path).map_err(|_| "Arquivo ausente.".to_string())
}

pub fn remove_stored(root: &Path, relative: &str) -> Result<(), String> {
    let path = join_storage(root, relative)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn write_backup(root: &Path, destination: &Path, manifest: &str, data: &str, relatives: &[String]) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let file = File::create(destination).map_err(|error| error.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    zip.start_file("manifest.json", options).map_err(|error| error.to_string())?;
    zip.write_all(manifest.as_bytes()).map_err(|error| error.to_string())?;
    zip.start_file("data.json", options).map_err(|error| error.to_string())?;
    zip.write_all(data.as_bytes()).map_err(|error| error.to_string())?;
    for relative in relatives {
        let bytes = read_stored(root, relative)?;
        let name = format!("files/{relative}");
        if name.contains("..") {
            return Err("Caminho interno inválido.".into());
        }
        zip.start_file(&name, options).map_err(|error| error.to_string())?;
        zip.write_all(&bytes).map_err(|error| error.to_string())?;
    }
    zip.finish().map_err(|error| error.to_string())?;
    Ok(())
}

pub fn inspect_backup(path: &Path) -> Result<(String, String), String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|_| "O backup não é um arquivo válido.".to_string())?;
    if archive.len() > MAX_ZIP_FILES {
        return Err("O backup tem arquivos demais.".into());
    }
    let manifest = String::from_utf8(read_entry_bytes(&mut archive, "manifest.json")?).map_err(|_| "O manifesto do backup é inválido.".to_string())?;
    let data_bytes = read_entry_bytes(&mut archive, "data.json")?;
    let data = String::from_utf8(data_bytes.clone()).map_err(|_| "Os dados do backup são inválidos.".to_string())?;
    if sha256_hex(&data_bytes) != manifest_hash(&manifest)? {
        return Err("A integridade dos dados do backup falhou.".into());
    }
    let parsed: Manifest = serde_json::from_str(&manifest).map_err(|_| "O manifesto do backup é inválido.".to_string())?;
    let mut total = data_bytes.len() as u64 + manifest.len() as u64;
    for entry in &parsed.files {
        safe_relative(&entry.path)?;
        let name = format!("files/{}", entry.path);
        let bytes = read_entry_bytes(&mut archive, &name)?;
        total += bytes.len() as u64;
        if total > MAX_ZIP_BYTES {
            return Err("O backup excede o tamanho permitido.".into());
        }
        if sha256_hex(&bytes) != entry.sha256 || bytes.len() as u64 != entry.bytes {
            return Err("A integridade de um arquivo do backup falhou.".into());
        }
    }
    Ok((manifest, data))
}

pub fn restore_backup_files(root: &Path, path: &Path) -> Result<(), String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|_| "O backup não é um arquivo válido.".to_string())?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        let name = entry.name().to_string();
        if !name.starts_with("files/") || name.contains("..") {
            continue;
        }
        let relative = name.trim_start_matches("files/");
        let destination = join_storage(root, relative)?;
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut bytes = Vec::new();
        entry.read_to_end(&mut bytes).map_err(|error| error.to_string())?;
        fs::write(destination, bytes).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn prune_storage(root: &Path, keep: &[String]) -> Result<(), String> {
    let allowed: std::collections::HashSet<&str> = keep.iter().map(String::as_str).collect();
    for folder in ["attachments", "pdfs"] {
        let directory = root.join(folder);
        if !directory.exists() {
            continue;
        }
        for entry in fs::read_dir(&directory).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            if !entry.file_type().map_err(|error| error.to_string())?.is_file() {
                continue;
            }
            let relative = format!("{folder}/{}", entry.file_name().to_string_lossy());
            if safe_relative(&relative).is_err() || allowed.contains(relative.as_str()) {
                continue;
            }
            fs::remove_file(entry.path()).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn manifest_hash(manifest: &str) -> Result<String, String> {
    let parsed: serde_json::Value = serde_json::from_str(manifest).map_err(|_| "O manifesto do backup é inválido.".to_string())?;
    parsed
        .get("dataSha256")
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
        .ok_or_else(|| "O manifesto do backup é inválido.".into())
}

fn read_entry_bytes(archive: &mut ZipArchive<File>, name: &str) -> Result<Vec<u8>, String> {
    let mut entry = archive.by_name(name).map_err(|_| format!("Falta {name} no backup."))?;
    if entry.size() > PDF_LIMIT {
        return Err("Um item do backup excede o tamanho permitido.".into());
    }
    let mut bytes = Vec::new();
    entry.read_to_end(&mut bytes).map_err(|error| error.to_string())?;
    Ok(bytes)
}

fn starts(bytes: &[u8], signature: &[u8]) -> bool {
    bytes.len() >= signature.len() && bytes[..signature.len()] == *signature
}

fn ascii_at(bytes: &[u8], offset: usize, text: &[u8]) -> bool {
    bytes.len() >= offset + text.len() && &bytes[offset..offset + text.len()] == text
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> PathBuf {
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let path = std::env::temp_dir().join(format!("zenstudies-storage-{nanos}"));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn rejects_path_traversal() {
        assert!(safe_relative("../secret.pdf").is_err());
        assert!(safe_relative("attachments/../../note.pdf").is_err());
        assert!(safe_relative("C:/Windows/notepad.exe").is_err());
    }

    #[test]
    fn stores_pdf_and_rejects_fake_extension() {
        let root = temp_dir();
        let stored = store_bytes(&root, "aula.pdf", b"%PDF-1.4 conteudo", Some("pdf")).unwrap();
        assert!(stored.relative_path.starts_with("pdfs/"));
        assert!(read_stored(&root, &stored.relative_path).unwrap().starts_with(b"%PDF"));
        let error = store_bytes(&root, "aula.pdf", b"nao e pdf", Some("pdf")).unwrap_err();
        assert!(error.contains("não aceito") || error.contains("conteúdo"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn backup_roundtrip_checks_hash() {
        let root = temp_dir();
        let stored = store_bytes(&root, "figura.png", &[0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0], Some("image")).unwrap();
        let data = "{\"ok\":true}";
        let file_hash = sha256_hex(&[0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0]);
        let manifest = format!(
            "{{\"dataSha256\":\"{}\",\"files\":[{{\"path\":\"{}\",\"sha256\":\"{}\",\"bytes\":8}}]}}",
            sha256_hex(data.as_bytes()),
            stored.relative_path,
            file_hash
        );
        let destination = root.join("backup.zenbackup");
        write_backup(&root, &destination, &manifest, data, &[stored.relative_path.clone()]).unwrap();
        let (read_manifest, read_data) = inspect_backup(&destination).unwrap();
        assert_eq!(read_data, data);
        assert!(read_manifest.contains(&file_hash));
        let _ = fs::remove_dir_all(root);
    }
}
