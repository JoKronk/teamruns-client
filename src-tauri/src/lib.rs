
mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::game::start_repl,
            commands::game::start_game,
            commands::game::close_game,
            commands::game::send_command,
            commands::settings::settings_read,
            commands::settings::settings_write,
            commands::settings::settings_select_path,
            commands::settings::settings_reset_size,
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
            commands::versions::update_check,
            commands::versions::update_start,
            commands::versions::install_check,
            commands::versions::install_start
            ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
