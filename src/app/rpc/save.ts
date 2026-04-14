import { LocalSave } from "@app/common/level/local-save";
import { invoke_rpc } from "./rpc";

export async function saveFetch(): Promise<LocalSave | null> {
  return await invoke_rpc("save_fetch", {}, () => null);
}

export async function saveWrite(save: LocalSave): Promise<boolean> {
  return await invoke_rpc("save_write", { save }, () => false);
}

export async function saveOpen(): Promise<void> {
  return await invoke_rpc("save_open", {}, () => {});
}