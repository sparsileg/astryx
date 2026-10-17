// src-tauri/src/cli.rs
// Command-line subcommands (issue #292). These definitions are the one list
// of what Astryx accepts: help text, usage lines and error messages all come
// from them. Each subcommand starts one task the app already does and exits.

use std::fs::{File, TryLockError};
use std::io::{IsTerminal, Write};
use std::path::Path;

use clap::{Parser, Subcommand};
use serde::Serialize;

/// Exit code for a task that failed; listed in EXIT_CODES
const EXIT_FAILED: i32 = 1;

/// Exit code for a command-line mistake, as clap uses; listed in EXIT_CODES
const EXIT_USAGE: i32 = 2;

/// Beside astryx.db in the data folder
const LOCK_FILE: &str = "astryx.lock";

const EXIT_CODES: &str = "\
Exit codes:
  0  success
  1  the task failed
  2  command-line mistake";

#[derive(Parser, Debug)]
#[command(
    name = "astryx",
    version,
    about = "Astrophotography planning and imaging session analysis.\n\
             With no subcommand, Astryx starts normally.",
    after_help = EXIT_CODES
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

/// Handed to the JS side as `{ "command": "reset-learned", ...arguments }`
#[derive(Subcommand, Serialize, Clone, Debug, PartialEq)]
#[serde(tag = "command", rename_all = "kebab-case")]
pub enum Command {
    /// Reset the learned Sub Gap and Dither Duration to their defaults
    #[command(after_help = EXIT_CODES)]
    ResetLearned,

    /// Analyze a Session Log with its PHD2 Guide Log; the PDF report goes to stdout
    ///
    /// Example: astryx analyze-logs Autorun_Log.txt PHD2_GuideLog.txt > report.pdf
    ///
    /// The Session Log's Sub Gap and Dither Duration are averaged into the
    /// learned values, as when the logs are loaded in Log Analysis. Messages
    /// go to stderr.
    #[command(after_help = EXIT_CODES, verbatim_doc_comment)]
    AnalyzeLogs {
        /// The ASIAir Session Log or the PHD2 Guide Log
        #[arg(value_name = "LOG")]
        log1: String,
        /// The other log
        #[arg(value_name = "LOG")]
        log2: String,
    },
}

/// The subcommand Astryx was started with, or None for a normal start.
/// Help and version requests print to stdout and exit with code 0; mistakes
/// print to stderr and exit with code 2. Neither starts the app.
pub fn parse() -> Option<Command> {
    if std::env::args_os().len() > 1 {
        attach_console();
    }
    let command = Cli::parse().command;
    if writes_pdf_to_terminal(&command, std::io::stdout().is_terminal()) {
        let _ = writeln!(
            std::io::stderr(),
            "analyze-logs writes a PDF to stdout; redirect it to a file:\n  \
             astryx analyze-logs <LOG> <LOG> > report.pdf"
        );
        std::process::exit(EXIT_USAGE);
    }
    command
}

/// A PDF sent to the terminal would only fill it with binary, so
/// analyze-logs needs stdout redirected (issue #293). Checked before any
/// log is read or anything is learned.
fn writes_pdf_to_terminal(command: &Option<Command>, stdout_is_terminal: bool) -> bool {
    stdout_is_terminal && matches!(command, Some(Command::AnalyzeLogs { .. }))
}

/// The Windows release build has no console of its own, so help, messages
/// and errors would go nowhere. Any run with arguments attaches to the
/// console of the cmd or PowerShell window that started it. A normal start
/// has no arguments and stays detached. Redirected output (`> file`) works
/// either way.
#[cfg(windows)]
fn attach_console() {
    use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    // Fails harmlessly when there's no parent console (started from Explorer)
    // or when this is a debug build, which has its own
    unsafe {
        AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

#[cfg(not(windows))]
fn attach_console() {}

/// Refuse a command-line run while Astryx is open. A command-line run
/// writes to the same database as the open app, which holds settings in
/// memory and would later overwrite the change. A normal start holds a
/// shared lock, so several windows still work; a command-line run needs the
/// lock to itself. The OS releases it when the process ends, even after a
/// crash. Runs after parse(), so help always works.
/// The returned file must stay open for the life of the process.
pub fn lock_instance(data_dir: &Path, command_line: bool) -> Option<File> {
    let result = try_lock(&data_dir.join(LOCK_FILE), command_line);
    if !command_line {
        // A normal start runs either way, as before
        return result.ok();
    }
    match result {
        Ok(file) => Some(file),
        Err(TryLockError::WouldBlock) => fail("Astryx is open; close it and try again"),
        Err(TryLockError::Error(e)) => fail(&format!("Couldn't check whether Astryx is open: {e}")),
    }
}

fn try_lock(path: &Path, exclusive: bool) -> Result<File, TryLockError> {
    let file = File::options()
        .create(true)
        .write(true)
        .truncate(false)
        .open(path)
        .map_err(TryLockError::Error)?;
    if exclusive {
        file.try_lock()?;
    } else {
        file.try_lock_shared()?;
    }
    Ok(file)
}

pub fn fail(message: &str) -> ! {
    let _ = writeln!(std::io::stderr(), "{message}");
    std::process::exit(EXIT_FAILED);
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::error::ErrorKind;

    fn parse_from(args: &[&str]) -> Result<Option<Command>, ErrorKind> {
        Cli::try_parse_from(args)
            .map(|cli| cli.command)
            .map_err(|e| e.kind())
    }

    #[test]
    fn no_arguments_is_a_normal_start() {
        assert_eq!(parse_from(&["astryx"]), Ok(None));
    }

    #[test]
    fn reset_learned() {
        assert_eq!(
            parse_from(&["astryx", "reset-learned"]),
            Ok(Some(Command::ResetLearned))
        );
    }

    #[test]
    fn analyze_logs() {
        assert_eq!(
            parse_from(&["astryx", "analyze-logs", "a.txt", "b.txt"]),
            Ok(Some(Command::AnalyzeLogs {
                log1: "a.txt".to_string(),
                log2: "b.txt".to_string(),
            }))
        );
        assert!(parse_from(&["astryx", "analyze-logs"]).is_err());
        assert!(parse_from(&["astryx", "analyze-logs", "a.txt"]).is_err());
        assert!(parse_from(&["astryx", "analyze-logs", "a.txt", "b.txt", "c.txt"]).is_err());
    }

    #[test]
    fn analyze_logs_needs_stdout_redirected() {
        let analyze = Some(Command::AnalyzeLogs {
            log1: String::new(),
            log2: String::new(),
        });
        assert!(writes_pdf_to_terminal(&analyze, true));
        assert!(!writes_pdf_to_terminal(&analyze, false));
        assert!(!writes_pdf_to_terminal(&Some(Command::ResetLearned), true));
        assert!(!writes_pdf_to_terminal(&None, true));
    }

    #[test]
    fn help_forms() {
        for args in [
            &["astryx", "--help"][..],
            &["astryx", "help"],
            &["astryx", "help", "reset-learned"],
            &["astryx", "reset-learned", "--help"],
            &["astryx", "help", "analyze-logs"],
        ] {
            assert_eq!(parse_from(args), Err(ErrorKind::DisplayHelp), "{args:?}");
        }
    }

    #[test]
    fn command_line_run_refused_while_open() {
        let path = std::env::temp_dir().join(format!("astryx-lock-test-{}", std::process::id()));
        let open_app = try_lock(&path, false).expect("normal start locks");
        let second_window = try_lock(&path, false);
        assert!(second_window.is_ok(), "a second window still starts");
        assert!(matches!(
            try_lock(&path, true),
            Err(TryLockError::WouldBlock)
        ));
        drop(open_app);
        drop(second_window);
        assert!(try_lock(&path, true).is_ok(), "allowed once closed");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn mistakes() {
        assert_eq!(
            parse_from(&["astryx", "bogus"]),
            Err(ErrorKind::InvalidSubcommand)
        );
        assert_eq!(
            parse_from(&["astryx", "--reset-learned"]),
            Err(ErrorKind::UnknownArgument)
        );
        assert_eq!(
            parse_from(&["astryx", "reset-learned", "extra"]),
            Err(ErrorKind::UnknownArgument)
        );
    }
}
