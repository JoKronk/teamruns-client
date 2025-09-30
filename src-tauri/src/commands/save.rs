
#[tauri::command]
pub fn save_fetch() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn save_write() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn save_open() {
  println!("I was invoked from JavaScript!");
}