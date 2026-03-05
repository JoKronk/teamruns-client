import { User } from "../user/user";

export interface LauncherConfig {
  activeVersion: any;
  autoUpdateGames: boolean;
  checkForLatestModVersion: boolean;
  deletePreviousVersions: boolean;
  games: GameConfigMap;
  installationDir: any;
  modSources: any[];
  proceedAfterSuccessfulOperation: boolean;
  requirements: Requirements;
  user: User;
  inDevMode: boolean;
  saveRecordingsLocally: boolean;
  version: string;
}

export interface Requirements {
  avx: boolean;
  bypassRequirements: boolean;
  openGL: boolean;
}

export type SupportedGame = "Jak1" | "Jak2" | "Jak3" | "JakX";

export interface GameConfig {
  isInstalled: boolean;
  mods: { [category: string]: { [modKey: string]: string; }; };
  secondsPlayed: number;
  texturePacks: string[];
  version: string | null;
}

export type GameConfigMap = {
  [key in SupportedGame]: GameConfig;
};