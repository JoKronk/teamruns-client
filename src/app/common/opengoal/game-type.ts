import { SupportedGame } from "../api/mod-release";

export class GameType {
  displayName: string;
  id: SupportedGame;

  constructor(id: SupportedGame, name: string) {
    this.id = id;
    this.displayName = name;
  }

  static getGames(): GameType[] {
    return [new GameType("jak1", "Jak 1"), new GameType("jak2", "Jak 2"), new GameType("jak3", "Jak 3")];
  }
}