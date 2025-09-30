
#[tauri::command]
pub fn start_repl() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn start_game() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn close_game() {
  println!("I was invoked from JavaScript!");
}

#[tauri::command]
pub fn send_command() {
  println!("I was invoked from JavaScript!");
}