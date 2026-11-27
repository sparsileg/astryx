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
/// become U+FFFD, as when the app reads a file the user picks. Only a file
/// the subcommand named, so a normal start reads nothing here (Issue #359).
#[tauri::command]
pub fn cli_read_file(path: String, cli: tauri::State<'_, CliCommand>) -> Result<String, String> {
    if !named_on_command_line(&cli.0, &path) {
        return Err(format!("{path} wasn't named on the command line"));
    }
    std::fs::read(&path)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .map_err(|e| format!("Couldn't read {path}: {e}"))
}

/// Whether `path` is a file the subcommand names, exactly as typed.
fn named_on_command_line(command: &Option<Command>, path: &str) -> bool {
    match command {
        Some(Command::AnalyzeLogs { log1, log2 }) => path == log1 || path == log2,
        Some(Command::ResetLearned) | None => false,
    }
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

#[cfg(test)]
mod tests {
    use super::named_on_command_line;
    use crate::cli::Command;

    #[test]
    fn only_the_logs_named_on_the_command_line_are_read() {
        let analyze = Some(Command::AnalyzeLogs {
            log1: "Autorun_Log.txt".into(),
            log2: "logs/PHD2_GuideLog.txt".into(),
        });
        assert!(named_on_command_line(&analyze, "Autorun_Log.txt"));
        assert!(named_on_command_line(&analyze, "logs/PHD2_GuideLog.txt"));
        assert!(!named_on_command_line(&analyze, "/home/me/.ssh/id_ed25519"));
        assert!(!named_on_command_line(&analyze, "./Autorun_Log.txt"));
        assert!(!named_on_command_line(
            &Some(Command::ResetLearned),
            "Autorun_Log.txt"
        ));
        assert!(!named_on_command_line(&None, "Autorun_Log.txt"));
    }
}
