import { LauncherConfig } from "@app/common/launcher/launcher-config";
import { invoke_rpc } from "./rpc";

export async function getSettings(): Promise<LauncherConfig | undefined> {
  return await invoke_rpc("get_settings", {}, () => undefined);
}

export async function updateSettings(launcherConfigs: LauncherConfig): Promise<void> {
  return await invoke_rpc("update_settings", { launcherConfig: launcherConfigs }, () => {});
}