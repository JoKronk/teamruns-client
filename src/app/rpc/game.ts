import { invoke_rpc } from "./rpc";

export async function gameLaunch(): Promise<number> {
  return await invoke_rpc("start_game", {}, () => 0);
}

export async function gameClose(port: number): Promise<number> {
  return await invoke_rpc("close_game", { socketPort: port }, () => 0);
}

export async function configUpdateActiveVersion(newActiveVersion: String): Promise<boolean> {
  return invoke_rpc("update_setting_value", { key: "active_version", val: newActiveVersion }, () => false, "Couldn't save active version change.", () => true);
}