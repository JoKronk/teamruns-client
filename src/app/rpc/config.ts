import { LauncherConfig } from "@app/common/launcher/launcher-config";
import { invoke_rpc } from "./rpc";

export async function getSettings(): Promise<LauncherConfig | undefined> {
  return await invoke_rpc("get_settings", {}, () => undefined);
}

export async function updateSettings(launcherConfigs: LauncherConfig): Promise<void> {
  return await invoke_rpc("update_settings", { launcherConfig: launcherConfigs }, () => {});
}

export async function configUpdateActiveVersion(newActiveVersion: String): Promise<boolean> {
  return invoke_rpc("update_setting_value", { key: "active_version", val: newActiveVersion }, () => false, "Couldn't save active version change.", () => true);
}