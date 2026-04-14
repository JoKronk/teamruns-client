import { invoke_rpc } from "./rpc";
import { Taunts } from "@app/common/opengoal/taunts";

export async function tauntsFetch(): Promise<Taunts[] | null> {
  return await invoke_rpc("taunts_fetch", {}, () => null);
}

export async function tauntsWrite(): Promise<void> {
  return await invoke_rpc("taunts_write", {}, () => {});
}