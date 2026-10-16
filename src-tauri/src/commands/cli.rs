// src-tauri/src/commands/cli.rs
// The command-line subcommand Astryx was started with, and the output and
// exit commands its task uses (issue #292). Text for a person goes to stderr,
// so stdout carries only a task's output, such as a PDF. Writing to stdout
// and stderr here is deliberate: this is the command line's output, not
// logging.

use std::io::Write;

use crate::cli::Command;

/// The parsed subcommand, held for the JS side; None for a normal start.
pub struct CliCommand(pub Option<Command>);

/// The subcommand to run, or null for a normal start.
#[tauri::command]
pub fn get_cli_command(cli: tauri::State<'_, CliCommand>) -> Option<Command> {
    cli.0.clone()
}

/// Write a line of text for the person at the terminal.
#[tauri::command]
pub fn cli_write_stderr(text: String) -> Result<(), String> {
    let mut stderr = std::io::stderr().lock();
    writeln!(stderr, "{text}").map_err(|e| e.to_string())
}

/// Write a task's output, such as a PDF. The bytes come as a JSON array of
/// numbers: WebKitGTK on Linux can't send a raw request body.
#[tauri::command]
pub fn cli_write_stdout(bytes: Vec<u8>) -> Result<(), String> {
    let mut stdout = std::io::stdout().lock();
    stdout
        .write_all(&bytes)
        .and_then(|_| stdout.flush())
        .map_err(|e| e.to_string())
}

/// Read a text file named on the command line. Bytes that aren't valid UTF-8
/// become U+FFFD, as when the app reads a file the user picks.
#[tauri::command]
pub fn cli_read_file(path: String) -> Result<String, String> {
    std::fs::read(&path)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .map_err(|e| format!("Couldn't read {path}: {e}"))
}

/// End the command-line run with an exit code: 0 success, 1 the task failed,
/// 2 command-line mistake. Every database write has finished by the time the
/// task calls this, so the process ends here without the app's shutdown.
#[tauri::command]
pub fn cli_exit(code: i32) {
    let _ = std::io::stdout().flush();
    let _ = std::io::stderr().flush();
    std::process::exit(code);
}
