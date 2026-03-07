import { arch, platform } from "@tauri-apps/plugin-os";
import { InjectNotification } from "./snackbar-injection";
import { GitRelease } from "@app/common/api/git-release";


function getDownloadLinkForCurrentPlatform(release) {
  let plat = platform();
  let matchingAsset;
  if (plat == "macos") {
    const userArch = arch() === "aarch64" ? "arm" : "intel";
    matchingAsset = release.assets.find(
      (asset) =>
        asset.name.toLowerCase().includes(plat) &&
        !asset.name.toLowerCase().includes(".bin") &&
        !asset.name.toLowerCase().includes("lsp") &&
        asset.name.toLowerCase().includes(userArch),
    );
  } else {
    matchingAsset = release.assets.find(
      (asset) =>
        asset.name.toLowerCase().includes(plat) &&
        !asset.name.toLowerCase().includes(".bin") &&
        !asset.name.toLowerCase().includes("lsp"),
    );
  }
  if (matchingAsset) {
    return matchingAsset.browser_download_url;
  }
  return undefined;
}

async function parseGithubRelease(githubRelease: any): Promise<GitRelease> {
  const gitRelease: GitRelease = {
    draft: githubRelease.draft,
    name: githubRelease.name,
    prerelease: githubRelease.prerelease,
    version: githubRelease.tag_name,
    date: githubRelease.published_at,
    githubLink: githubRelease.html_url,
    downloadUrl: await getDownloadLinkForCurrentPlatform(githubRelease),
    isDownloaded: false,
  };

  return gitRelease;
}

export async function listGithubReleases(url: string): Promise<GitRelease[]> {
  const nextUrlPattern = /<([\S]+)>; rel="Next"/i;
  let releases: GitRelease[] = [];
  let urlToHit: string | undefined = url.endsWith("?per_page=100") ? url : (url + "?per_page=100");

  while (urlToHit !== undefined) {
    const resp = await fetch(urlToHit);
    if (resp.status === 403 || resp.status === 429) {

      InjectNotification("Github Rate Limit Reached!");
      return [];
    } else if (!resp.ok) {
      InjectNotification("Unexpected error fetching github releases!");
      return [];
    }

    const githubReleases = await resp.json();
    for (const release of githubReleases) {
      releases.push(await parseGithubRelease(release));
    }

    if (resp.headers.has("link") && resp.headers.get("link")!.includes(`rel=\"next\"`)) {
      // we must paginate!
      urlToHit = resp.headers.get("link")!.match(nextUrlPattern)![1];
    } else {
      urlToHit = undefined;
    }
  }
  return releases.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getLatestOfficialRelease(): Promise<
  GitRelease | undefined
> {
  const resp = await fetch(
    "https://api.github.com/repos/JoKronk/teamruns-jak-project/releases/latest",
  );
  if (resp.status === 403 || resp.status === 429) {
    
    InjectNotification("Github Rate Limit Reached!");
    return undefined;
  } else if (!resp.ok) {
    InjectNotification("Unexpected error fetching github releases!");
    return undefined;
  }
  const githubRelease = await resp.json();
  return await parseGithubRelease(githubRelease);
}
