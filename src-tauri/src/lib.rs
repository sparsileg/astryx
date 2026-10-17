// src-tauri/src/lib.rs
// Tauri application entry point, application state, and command registration.

mod cli;
mod commands;
mod db;

use std::sync::{Arc, Mutex, MutexGuard};

use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

use commands::cli::CliCommand;

// ── Application state ─────────────────────────────────────────────────────────

pub struct AstryxState {
    pub db: Mutex<rusqlite::Connection>,
}

impl AstryxState {
    /// Lock the database for one command. A poisoned lock (a panic while it
    /// was held) becomes a command error rather than a second panic.
    pub fn conn(&self) -> Result<MutexGuard<'_, rusqlite::Connection>, String> {
        self.db
            .lock()
            .map_err(|_| "database lock poisoned".to_string())
    }
}

// ── Application entry point ───────────────────────────────────────────────────

/// Report why the app can't start and exit: in a dialog on a normal start,
/// since no window exists yet, and on stderr either way (Issue #301)
fn cannot_start(message: &str, command_line: bool) -> ! {
    if !command_line {
        rfd::MessageDialog::new()
            .set_level(rfd::MessageLevel::Error)
            .set_title("Astryx can't start")
            .set_description(message)
            .set_buttons(rfd::MessageButtons::Ok)
            .show();
    }
    cli::fail(message)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Before anything else, so help and command-line mistakes never start
    // the app or open the database (issue #292)
    let command = cli::parse();

    let app_data_dir = dirs_next::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Astryx");
    let command_line = command.is_some();
    if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
        cannot_start(
            &format!(
                "Couldn't create the data folder {}: {e}",
                app_data_dir.display()
            ),
            command_line,
        );
    }

    let _instance_lock = cli::lock_instance(&app_data_dir, command_line);

    let db_conn = db::open_db(&app_data_dir).unwrap_or_else(|e| cannot_start(&e, command_line));

    let state = Arc::new(AstryxState {
        db: Mutex::new(db_conn),
    });

    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // The main window is created here rather than automatically
            // (tauri.conf.json "create": false), hidden on a command-line run
            // (issue #292). Creating it hidden and showing it later leaves
            // its title-bar buttons dead on KDE Wayland.
            let window_config = app
                .config()
                .app
                .windows
                .first()
                .ok_or("tauri.conf.json defines no window")?
                .clone();
            tauri::WebviewWindowBuilder::from_config(app.handle(), &window_config)?
                .visible(app.state::<CliCommand>().0.is_none())
                .build()?;
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        // Size and position are remembered, visibility isn't: a hidden
        // command-line run must not make the next start open hidden (#292)
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .manage(state)
        .manage(CliCommand(command))
        .invoke_handler(tauri::generate_handler![
            // Settings
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::get_target_version,
            commands::settings::set_target_version,
            // Locations
            commands::locations::get_all_locations,
            commands::locations::save_location,
            commands::locations::delete_location,
            // Telescopes
            commands::telescopes::get_all_telescopes,
            commands::telescopes::save_telescope,
            commands::telescopes::delete_telescope,
            // Sensors
            commands::sensors::get_all_sensors,
            commands::sensors::save_sensor,
            commands::sensors::delete_sensor,
            // Filters
            commands::filters::get_all_filters,
            commands::filters::save_filter,
            commands::filters::delete_filter,
            // Targets
            commands::targets::get_all_targets,
            commands::targets::save_target,
            commands::targets::save_targets_bulk,
            commands::targets::delete_all_targets,
            // Pinned Targets
            commands::pinned_targets::get_all_pinned_targets,
            commands::pinned_targets::save_pinned_target,
            commands::pinned_targets::delete_pinned_target,
            commands::pinned_targets::clear_pinned_targets,
            // To Do Targets
            commands::todo_targets::get_all_todo_targets,
            commands::todo_targets::save_todo_target,
            commands::todo_targets::delete_todo_target,
            commands::todo_targets::clear_todo_targets,
            // Imaging Projects
            commands::imaging_projects::get_all_projects,
            commands::imaging_projects::get_project,
            commands::imaging_projects::create_project,
            commands::imaging_projects::update_project,
            commands::imaging_projects::delete_project,
            // Imaging Sessions
            commands::imaging_sessions::get_all_sessions,
            commands::imaging_sessions::get_sessions_for_project,
            commands::imaging_sessions::get_session,
            commands::imaging_sessions::create_session,
            commands::imaging_sessions::update_session,
            commands::imaging_sessions::delete_session,
            // Imaging Programs
            commands::imaging_programs::get_all_programs,
            commands::imaging_programs::get_program,
            commands::imaging_programs::create_program,
            commands::imaging_programs::update_program,
            commands::imaging_programs::delete_program,
            // Backup
            commands::backup::read_zip_backup,
            commands::backup::write_backup_file,
            commands::backup::restore_stores,
            // Tutorial Progress
            commands::tutorial_progress::get_tutorial_progress,
            commands::tutorial_progress::save_tutorial_progress,
            commands::tutorial_progress::delete_tutorial_progress,
            // Help
            commands::help::open_user_guide,
            // Command line
            commands::cli::get_cli_command,
            commands::cli::cli_write_stderr,
            commands::cli::cli_write_stdout,
            commands::cli::cli_read_file,
            commands::cli::cli_exit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ----------------------------------------------------------------------
