use super::CommandError;
use crate::config::{LauncherConfig, SupportedGame};
use serde_json::{Value, json};


#[tauri::command]
pub async fn reset_to_defaults (config: tauri::State<'_, tokio::sync::Mutex<LauncherConfig>>) -> Result<(), CommandError> {
  let mut config_lock = config.lock().await;
  config_lock.reset_to_defaults().map_err(|_| {
    CommandError::Configuration("Unable to reset configuration to defaults".to_owned())
  })?;
  Ok(())
}

#[tauri::command]
pub async fn update_setting_value (config: tauri::State<'_, tokio::sync::Mutex<LauncherConfig>>, key: String, val: Value, game_name: Option<SupportedGame>) -> Result<(), CommandError> {
  let mut config_lock = config.lock().await;
  match &config_lock.update_setting_value(&key, val, game_name) {
    Ok(()) => Ok(()),
    Err(e) => {
      log::error!("Unable to get setting directory: {:?}", e);
      Err(CommandError::Configuration(
        "Unable to update setting".to_owned(),
      ))
    }
  }
}

#[tauri::command]
pub async fn get_setting_value (config: tauri::State<'_, tokio::sync::Mutex<LauncherConfig>>, key: String, game_name: Option<SupportedGame>) -> Result<Value, CommandError> {
  let config_lock = config.lock().await;
  match &config_lock.get_setting_value(&key, game_name) {
    Ok(value) => Ok(json!(value)),
    Err(e) => {
      log::error!("Unable to get setting directory: {:?}", e);
      Err(CommandError::Configuration(
        "Unable to get setting".to_owned(),
      ))
    }
  }
}

#[tauri::command]
pub async fn get_settings (config: tauri::State<'_, tokio::sync::Mutex<LauncherConfig>>) -> Result<Value, CommandError> {
  println!("get_settings called");
  let config_lock = config.lock().await;
  Ok(json!(*config_lock))
}

#[tauri::command]
pub fn settings_write() {
    println!("Invoked command not implemented yet!");
}

#[tauri::command]
pub fn settings_select_path() {
    println!("Invoked command not implemented yet!");
}

#[tauri::command]
pub fn settings_reset_size() {
    println!("Invoked command not implemented yet!");
}
