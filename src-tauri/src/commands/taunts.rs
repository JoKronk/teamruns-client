
#[tauri::command]
pub fn taunts_fetch() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn taunts_write() {
  println!("I was invoked from JavaScript!");
}