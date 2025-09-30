

#[tauri::command]
pub fn update_check() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn update_start() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn install_check() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn install_start() {
  println!("I was invoked from JavaScript!");
}