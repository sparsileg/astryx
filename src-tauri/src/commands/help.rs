// src-tauri/src/commands/help.rs
// Opens the User Guide PDF in the system viewer; the webview can't show PDFs.

use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

const GUIDE_FILE_NAME: &str = "astryx-guide.pdf";

/// The frontend fetches the bundled PDF and sends its bytes as the request
/// body: raw where the platform's IPC supports it, a JSON array of numbers
/// otherwise (Linux). They're written to the app cache so the viewer has a
/// file to open.
#[tauri::command]
pub fn open_user_guide(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let pdf: Vec<u8> = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        InvokeBody::Json(value) => {
            serde_json::from_value(value.clone()).map_err(|e| e.to_string())?
        }
    };
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    let path = cache_dir.join(GUIDE_FILE_NAME);
    std::fs::write(&path, pdf).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}
