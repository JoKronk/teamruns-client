import { PlayerState } from "../player/player-state";
import { RunMode } from "../run/run-mode";
import { Run } from "../run/run";
import { Team } from "../run/team";
import { User } from "./user";
import { SocketHandler } from "../socket/socket-handler";
import { NgZone } from "@angular/core";
import { SocketHandlerLockout } from "../socket/socket-handler-lockout";
import { ConnectionHandler } from "../peer/connection-handler";

export class LocalPlayerData {
  user: User;
  mode: RunMode = RunMode.Speedrun;
  state: PlayerState = PlayerState.Neutral;

  socketHandler: SocketHandler;

  constructor(user: User, port: number, connectionHandler: ConnectionHandler, run: Run, zone: NgZone) {
    this.user = user;
    this.mode = run.data.mode;

    switch (run.data.mode) {
      case RunMode.Lockout:
        this.socketHandler = new SocketHandlerLockout(port, user, connectionHandler, run, this.state, zone);
        break;
      default:
        this.socketHandler = new SocketHandler(port, user, connectionHandler, run, this.state, zone);
        break;
    }
  }

  updateTeam(team: Team | undefined) {
    if (!team) return;
    this.socketHandler.localTeam = team;
  }

  onDestroy(): void {
    (window as any).electron.send('og-close-game', this.socketHandler.socketPort);
    this.socketHandler.onDestroy();
  }
}