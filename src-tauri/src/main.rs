// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, RunEvent};
use tokio::sync::OnceCell;

mod cache;
mod commands;
mod config;
mod util;

static TAURI_APP: OnceCell<tauri::AppHandle> = OnceCell::const_new();


fn main() {
    unsafe {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }

    let tauri_setup = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let _ = TAURI_APP.set(app.handle().clone());

            //sets up a config file as globally accessable through tauri::State
            let config = tokio::sync::Mutex::new(config::LauncherConfig::load_config(
                app.path().app_config_dir().ok(),
            ));
            app.manage(config);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::game::start_repl,
            commands::game::start_game,
            commands::game::close_game,
            commands::game::send_command,
            commands::download::download_file,
            commands::config::reset_to_defaults,
            commands::config::update_setting_value,
            commands::config::get_setting_value,
            commands::config::get_settings,
            commands::config::settings_write,
            commands::config::settings_select_path,
            commands::config::settings_reset_size,
            commands::recordings::recording_download,
            commands::recordings::recording_fetch,
            commands::recordings::recording_write,
            commands::recordings::recording_open,
            commands::splits::splits_fetch,
            commands::splits::splits_write,
            commands::taunts::taunts_fetch,
            commands::taunts::taunts_write,
            commands::save::save_fetch,
            commands::save::save_write,
            commands::save::save_open,
            commands::versions::update_check_launcher,
            commands::versions::list_downloaded_versions,
            commands::versions::download_game_version, //update-start
            commands::versions::install_check,
            commands::versions::install_start
        ])
        .build(tauri::generate_context!());

    match tauri_setup {
        Ok(app) => {
            log::info!("application starting up");
            app.run(|_app_handle, event| {
                if let RunEvent::ExitRequested { .. } = event {
                    log::info!("Exit requested, exiting!");
                    std::process::exit(0);
                }
            })
        }
        Err(err) => {
            println!("ERROR: {:?}", err);
            //TODO: Look at how the error logging actually works
            //log::error!("Could not setup tauri application {:?}, exiting", err);
            std::process::exit(1);
        }
    };
}
