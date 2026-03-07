import { invoke_rpc } from "./rpc";

export async function updateCheckLauncher(): Promise<string> {
  return await invoke_rpc("update_check_launcher", {}, () => "");
}

export async function listDownloadedVersions(): Promise<string[]> {
  return await invoke_rpc("list_downloaded_versions", { versionFolder: "teamruns" }, () => []);
}

export async function downloadToolingVersion(version: String, url: String): Promise<boolean> {
  return await invoke_rpc("download_tooling_version", { version, url, versionFolder: "teamruns" }, () => false, "Unable to download tooling version", () => true);
}