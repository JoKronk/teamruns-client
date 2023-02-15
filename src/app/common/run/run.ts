import { LocalPlayerData } from "../user/local-player-data";
import { Player } from "../player/player";
import { RunMode } from "./run-mode";
import { RunData } from "./run-data";
import { GameState } from "../player/game-state";
import { Task } from "./task";
import { Team } from "./team";
import { Timer } from "./timer";
import { PlayerState } from "../player/player-state";
import { GoalService } from "src/app/services/goal.service";
import { RunState } from "./run-state";

export class Run {
    id: string;
    data: RunData;
    teams: Team[];
    timer: Timer;

    constructor(runData: RunData, teamsCount: number) {
        this.id = crypto.randomUUID();
        this.data = runData;
        this.teams = [];
        this.timer = new Timer(15);

        for (let i = 0; i < teamsCount; i++)
            this.teams.push(new Team("Team " + (i + 1)));
    }

    removePlayer(playerName: string): void {
        let team = this.getPlayerTeam(playerName);
        if (!team) return;
        team.players = team.players.filter(x => x.name !== playerName);
    }

    toggleVoteReset(playerName: string, state: PlayerState): boolean {
        let player = this.getPlayer(playerName);
        if (!player) return false;
        player.state = state;

        if (state === PlayerState.WantsToReset)
            return this.checkForRunReset();

        return false;
    }

    checkForRunReset(): boolean {
        let players = this.teams.flatMap(x => x.players);
        if (players.filter(x => x.state === PlayerState.WantsToReset).length / players.length <= 0.65)
            return false;
        
        this.timer.reset();
        this.teams.forEach(team => {
            team.tasks = [];
            team.players.forEach(player => {
                player.state = PlayerState.Neutral;
            })
        });
        return true;
    }

    endPlayerRun(playerName: string): void {
        let player = this.getPlayer(playerName);
        if (!player) return;
        player.state = PlayerState.Finished;
        if (this.everyoneHasFinished())
            this.timer.runState = RunState.Ended;
    }

    everyoneHasFinished(): boolean {
        return this.teams.every(x => x.players.every(y => y.state === PlayerState.Finished || y.state === PlayerState.Forfeit));
    }

    updateState(playerName: string, state: GameState): void {
        let player = this.getPlayer(playerName);
        if (!player) return;
        player.gameState = state;
    }

    addSplit(task: Task): void {
        this.getPlayerTeam(task.obtainedBy)?.tasks.unshift(task);
    }

    toggleReady(playerName: string, state: PlayerState): void {
        let player = this.getPlayer(playerName);
        if (!player) return;
        player.state = state;
    }

    everyoneIsReady(): boolean {
        return this.teams.every(x => x.players.every(y => y.state === PlayerState.Ready));
    }

    start(startDate: Date) {
        startDate.setSeconds(startDate.getSeconds() + this.timer.countdownSeconds - 1);
        this.timer.startTimer(startDate.getTime());
    }

    switchTeam(playerName: string, teamName: string): boolean {
      let newTeam = this.teams.find(x => x.name === teamName);
      if (!newTeam) return false;
  
      let oldTeam = this.teams.find(x => x.players.some(player => player.name === playerName));
      
  
      let player = oldTeam ? oldTeam.players.find(x => x.name === playerName) : new Player(playerName);
      newTeam.players.push(player!);
      //cheap method of forcing screen to re-render old team
      if (oldTeam) {
        let players = oldTeam.players.filter(x => x.name !== playerName);
        oldTeam.players = [];
        oldTeam.players = players;
      }
      return true;
    }
    
    getTimerShortenedFormat(): string {
        let time = this.timer.time + this.timer.timeMs;
        for (let i = 0; i < 3 && (time.charAt(0) === "0" || time.charAt(0) === ":"); i++)
            time = time.substring(1);
        return time;
    }

    getPlayerTeam(playerName: string): Team | undefined {
        return this.teams.find(x => x.players.some(player => player.name === playerName));
    }

    getPlayer(playerName: string): Player | undefined {
        return this.getPlayerTeam(playerName)?.players.find(x => x.name === playerName);
    }
}