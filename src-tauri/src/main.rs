// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use fern::colors::{Color, ColoredLevelConfig};
use tauri::{Manager, RunEvent};
use tokio::sync::OnceCell;
use util::file::create_dir;

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
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let _ = TAURI_APP.set(app.handle().clone());
            

            // Setup Logging
            let log_path = app.path().app_log_dir().expect("Could not determine log path").join("app");
            create_dir(&log_path)?;

            // configure colors for the whole line
            let colors_line = ColoredLevelConfig::new()
                .error(Color::Red)
                .warn(Color::Yellow)
                .info(Color::Cyan)
                .debug(Color::Green)
                .trace(Color::White);

            // configure colors for the name of the level.
            // since almost all of them are the same as the color for the whole line, we
            // just copy `colors_line` and overwrite our changes
            let colors_level = colors_line.info(Color::Cyan);

            let log_setup_ok = fern::Dispatch::new()
                // Perform allocation-free log formatting
                .format(move |out, message, record| {
                    out.finish(format_args!(
                        "{color_line}[{date}][{target}][{level}{color_line}] {message}\x1B[0m",
                        color_line = format_args!(
                            "\x1B[{}m",
                            colors_line.get_color(&record.level()).to_fg_str()
                        ),
                        date = chrono::Local::now().format("%H:%M:%S"),
                        target = record.target(),
                        level = colors_level.color(record.level()),
                        message = message,
                    ));
                })
                // Add blanket level filter -
                .level(log::LevelFilter::Debug)
                .filter(|metadata| metadata.target() != "tao::platform_impl::platform::event_loop::runner") // suppress tauri log spam (windows only)
                // - and per-module overrides
                // .level_for("opengoal-launcher", log::LevelFilter::Debug)
                // Output to stdout, files, and other Dispatch configurations
                .chain(std::io::stdout())
                .chain(fern::DateBased::new(&log_path, "/%Y-%m-%d.log"))
                // Apply globally
                .apply();
            match log_setup_ok {
                Ok(_) => {
                log::info!("Logging Initialized");
                // Truncate rotated log files to '5'
                let mut paths: Vec<_> = std::fs::read_dir(&log_path)?.map(|r| r.unwrap()).collect();
                paths.sort_by_key(|dir| dir.path());
                    paths.reverse();
                    let mut i = 0;
                    for path in paths {
                        i += 1;
                        if i > 5 {
                            log::info!("deleting - {}", path.path().display());
                            std::fs::remove_file(path.path())?;
                        }
                    }
                }
                Err(err) => log::error!("Could not initialize logging {:?}", err),
            };

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
            commands::logging::frontend_log,
            commands::download::download_file,
            commands::config::reset_to_defaults,
            commands::config::update_setting_value,
            commands::config::update_settings,
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
            commands::versions::update_start,
            commands::versions::list_downloaded_versions,
            commands::versions::download_tooling_version,
            commands::versions::install_check
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
            log::error!("Could not setup tauri application {:?}, exiting", err);
            std::process::exit(1);
        }
    };
}
