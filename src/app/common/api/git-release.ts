export interface GitRelease {
    draft: boolean;
    name: string;
    prerelease: boolean;
    githubLink: string | undefined;
    date: string;
    version: string;
    downloadUrl: string;
    isDownloaded: boolean;
}