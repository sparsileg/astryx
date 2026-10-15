// src-tauri/src/commands/startup.rs
// Command-line options the app was started with, such as --reset-learned
// (Guide appendix "Command-Line Options", issue #281).

/// The arguments after the program name, as given.
#[tauri::command]
pub fn get_startup_args() -> Vec<String> {
    std::env::args().skip(1).collect()
}
