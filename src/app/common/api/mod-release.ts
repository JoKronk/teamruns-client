

export type SupportedGame = "jak1" | "jak2" | "jak3" | "jakx";

export interface ModVersion {
  version: string;
  publishedDate: string;
  assets: Record<string, string | null>;
  supportedGames?: SupportedGame[];
}

interface ModPerGameConfig {
  coverArtUrl?: string;
  thumbnailArtUrl?: string;
  releaseDate?: string;
}

export interface ModInfo {
  id: string;
  displayName: string;
  description: string;
  authors: string[];
  tags: string[];
  supportedGames: SupportedGame[];
  websiteUrl?: string;
  versions: ModVersion[];
  perGameConfig?: Record<string, ModPerGameConfig>;
  coverArtUrl?: string;
  thumbnailArtUrl?: string;
  externalLink?: string;
}

export interface ModSourceData {
  sourceName: string;
  lastUpdated: string;
  mods: Record<string, ModInfo>;
  texturePacks: Record<string, ModInfo>;
}