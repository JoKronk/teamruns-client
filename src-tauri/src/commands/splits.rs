
#[tauri::command]
pub fn splits_fetch() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn splits_write() {
  println!("I was invoked from JavaScript!");
}