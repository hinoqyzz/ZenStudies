mod storage;

use chrono::Utc;
use serde::Deserialize;
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

fn storage_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|error| error.to_string())?.join("storage");
    fs::create_dir_all(root.join("attachments")).map_err(|error| error.to_string())?;
    fs::create_dir_all(root.join("pdfs")).map_err(|error| error.to_string())?;
    Ok(root)
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn validate_route(route: &str) -> Result<String, String> {
    let allowed = route == "/"
        || route == "/captura"
        || route == "/revisoes"
        || route == "/revisoes/sessao"
        || route == "/biblioteca"
        || route == "/pdfs"
        || route == "/configuracoes"
        || route == "/lixeira"
        || route.starts_with("/notas/")
        || route.starts_with("/janela/nota/")
        || route.starts_with("/janela/pdf/")
        || route.starts_with("/pdfs/");
    if !allowed || route.contains("..") || route.contains("://") || route.contains('\\') || route.len() > 180 {
        return Err("Rota de janela não permitida.".into());
    }
    Ok(route.to_string())
}

fn validate_label(label: &str) -> Result<String, String> {
    let ok = label == "main"
        || label == "capture"
        || label == "review"
        || label == "settings"
        || (label.starts_with("note-") && label.len() < 80)
        || (label.starts_with("pdf-") && label.len() < 80);
    if !ok || label.contains("..") || label.contains('/') {
        return Err("Janela não permitida.".into());
    }
    Ok(label.to_string())
}

#[tauri::command]
fn import_path(app: AppHandle, path: String, kind: String) -> Result<storage::StoredFile, String> {
    let bytes = fs::read(&path).map_err(|_| "Não foi possível ler o arquivo escolhido.".to_string())?;
    let name = storage::original_name(&path);
    storage::store_bytes(&storage_root(&app)?, &name, &bytes, Some(kind.as_str()))
}

#[tauri::command]
fn import_bytes(app: AppHandle, name: String, bytes: Vec<u8>, kind: String) -> Result<storage::StoredFile, String> {
    storage::store_bytes(&storage_root(&app)?, &name, &bytes, Some(kind.as_str()))
}

#[tauri::command]
fn read_managed(app: AppHandle, relative_path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = storage::read_stored(&storage_root(&app)?, &relative_path)?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn exists_managed(app: AppHandle, relative_path: String) -> Result<bool, String> {
    Ok(storage::join_storage(&storage_root(&app)?, &relative_path)?.exists())
}

#[tauri::command]
fn remove_managed(app: AppHandle, relative_path: String) -> Result<(), String> {
    storage::remove_stored(&storage_root(&app)?, &relative_path)
}

#[tauri::command]
fn open_managed(app: AppHandle, relative_path: String) -> Result<(), String> {
    let path = storage::join_storage(&storage_root(&app)?, &relative_path)?;
    if !path.exists() {
        return Err("Arquivo ausente.".into());
    }
    app.opener().open_path(path.to_string_lossy().to_string(), None::<&str>).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_backup(app: AppHandle, destination: String, manifest: String, data: String, relative_paths: Vec<String>) -> Result<(), String> {
    storage::write_backup(&storage_root(&app)?, PathBuf::from(destination).as_path(), &manifest, &data, &relative_paths)
}

#[tauri::command]
fn inspect_backup(path: String) -> Result<serde_json::Value, String> {
    let (manifest, data) = storage::inspect_backup(PathBuf::from(path).as_path())?;
    Ok(json!({ "manifest": manifest, "data": data }))
}

#[tauri::command]
fn restore_backup_files(app: AppHandle, path: String) -> Result<(), String> {
    storage::restore_backup_files(&storage_root(&app)?, PathBuf::from(path).as_path())
}

#[tauri::command]
fn prune_storage(app: AppHandle, keep: Vec<String>) -> Result<(), String> {
    storage::prune_storage(&storage_root(&app)?, &keep)
}

#[tauri::command]
fn safety_backup_path(app: AppHandle) -> Result<String, String> {
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?.join("safety");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let stamp = Utc::now().format("%Y%m%d-%H%M%S");
    Ok(directory.join(format!("zenstudies-seguranca-{stamp}.zenbackup")).to_string_lossy().to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowSpec {
    label: String,
    route: String,
    title: String,
    width: f64,
    height: f64,
}

#[tauri::command]
fn open_window(app: AppHandle, spec: WindowSpec) -> Result<(), String> {
    let label = validate_label(&spec.label)?;
    let route = validate_route(&spec.route)?;
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return Ok(());
    }
    let script = format!(
        "window.__ZEN_ROUTE__={};if(!location.hash) location.hash='#'+window.__ZEN_ROUTE__;",
        serde_json::to_string(&route).unwrap_or_else(|_| "\"/\"".into())
    );
    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title(spec.title)
        .inner_size(spec.width, spec.height)
        .min_inner_size(480.0, 360.0)
        .resizable(true)
        .maximizable(true)
        .initialization_script(&script)
        .build()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn hide_main(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_main_window(app: AppHandle) {
    show_main(&app);
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn is_main_visible(app: AppHandle) -> bool {
    app.get_webview_window("main").and_then(|window| window.is_visible().ok()).unwrap_or(false)
}

#[tauri::command]
fn publish_sync(app: AppHandle, event: serde_json::Value) -> Result<(), String> {
    app.emit("app://sync", event).map_err(|error| error.to_string())
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;
    let open = MenuItem::with_id(app, "open", "Abrir ZenStudies", true, None::<&str>)?;
    let capture = MenuItem::with_id(app, "capture", "Captura rápida", true, None::<&str>)?;
    let focus = MenuItem::with_id(app, "focus", "Iniciar sessão de foco", true, None::<&str>)?;
    let review = MenuItem::with_id(app, "review", "Iniciar revisões pendentes", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Configurações", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair completamente", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &capture, &focus, &review, &settings, &quit])?;
    let mut builder = TrayIconBuilder::new().menu(&menu).tooltip("ZenStudies").on_menu_event(|app, event| {
        if event.id().as_ref() == "open" {
            show_main(app);
        }
        let _ = app.emit("tray://action", event.id().as_ref());
    });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            import_path,
            import_bytes,
            read_managed,
            exists_managed,
            remove_managed,
            open_managed,
            write_backup,
            inspect_backup,
            restore_backup_files,
            prune_storage,
            safety_backup_path,
            open_window,
            hide_main,
            show_main_window,
            quit_app,
            is_main_visible,
            publish_sync
        ])
        .setup(|app| {
            if let Err(error) = setup_tray(app.handle()) {
                eprintln!("bandeja indisponível: {error}");
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.emit("app://close-requested", ());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o ZenStudies");
}
