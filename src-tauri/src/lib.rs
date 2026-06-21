// src-tauri/src/lib.rs
// Tauri application entry point, application state, and command registration.

mod commands;
mod db;

use std::sync::{Arc, Mutex};
use tauri_plugin_shell::ShellExt;

// ── Application state ─────────────────────────────────────────────────────────

pub struct AstryxState {
    pub db: Mutex<rusqlite::Connection>,
}

// ── Application entry point ───────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_data_dir = dirs_next::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Astryx");
    std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

    let db_conn = db::open_db(app_data_dir).expect("Failed to open database");

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
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(state)
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
            // Backup
            commands::backup::read_zip_backup,
            commands::backup::restore_imaging_log,
            // Tutorial Progress
            commands::tutorial_progress::get_tutorial_progress,
            commands::tutorial_progress::save_tutorial_progress,
            commands::tutorial_progress::delete_tutorial_progress,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ----------------------------------------------------------------------
