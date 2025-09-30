
#[tauri::command]
pub fn settings_read() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn settings_write() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn settings_select_path() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn settings_reset_size() {
  println!("I was invoked from JavaScript!");
}