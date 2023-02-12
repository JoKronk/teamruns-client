import { Player } from "../player/player";
import { State } from "../player/state";
import { Task } from "./task";
import { Team } from "./team";
import { Timer } from "./timer";

export class Run {
    name: string;
    teams: Team[];
    timer: Timer;
    owner: string;
    maxSize: number;

    started: boolean;

    constructor(name: string, teamsCount: number, teamCap: number, creator: Player) {
        this.name = name;
        this.teams = [];
        this.owner = creator.name;
        this.maxSize = teamsCount * teamCap;
        this.timer = new Timer(15);

        for (let i = 0; i < teamsCount; i++) {
            let team = new Team("Team " + (i + 1), teamCap);

            if (i === 0) {
                team.owner = creator.name;
                team.isPlayersCurrentTeam = true;
                team.players.push(creator);
            }
            
            this.teams.push(team);
        } 
    }

    addNewPlayer(player: Player): void {
        this.teams.forEach(team => {
            if (team.players.length < team.playerCap) {
                team.players.push(player);
                return;
            }

        })
    }

    toggleVoteReset(playerName: string, reset:boolean): boolean {
        let player = this.getPlayer(playerName);
        if (!player) return false;
        player.wantsToReset = reset;

        if (reset)
            return this.checkForRunReset();

        return false;
    }

    checkForRunReset(): boolean {
        let players = this.teams.flatMap(x => x.players);
        if (players.filter(x => x.wantsToReset).length / players.length <= 0.65)
            return false;
        
        this.timer.reset();
        this.teams.forEach(team => {
            team.tasks = [];
            team.players.forEach(player => {
                player.ready = false;
                player.wantsToReset = false;
            })
        });
        return true;
    }

    updateState(playerName: string, state: State): void {
        let player = this.getPlayer(playerName);
        if (!player) return;
        player.state = state;
    }

    addSplit(task: Task): void {
        this.getPlayerTeam(task.obtainedBy)?.tasks.unshift(task);
    }

    toggleReady(playerName: string, setTo: boolean): void {
        let player = this.getPlayer(playerName);
        if (!player) return;
        player.ready = setTo;
    }

    everyIsReady(): boolean {
        return !this.teams.some(x => x.players.some(y => !y.ready));
    }

    start(startDate: Date) {
        this.timer.startTimer(startDate);
    }

    switchTeam(playerName: string, teamName: string, userName: string): void {
      let newTeam = this.teams.find(x => x.name === teamName);
      if (!newTeam) return;
  
      let oldTeam = this.teams.find(x => x.players.some(player => player.name === playerName));
      if (!oldTeam) return;
  
      let player = oldTeam.players.find(x => x.name === playerName)!;
      if (player.name === userName) {
        oldTeam.isPlayersCurrentTeam = false;
        newTeam.isPlayersCurrentTeam = true;
      }
      newTeam.players.push(player);
      //cheap method of forcing screen to re-render old team
      let players = oldTeam.players.filter(x => x.name !== playerName);
      oldTeam.players = [];
      oldTeam.players = players;
    }
    
    getTimerShortenedFormat(): string {
        let time = this.timer.time + this.timer.timeMs;
        for (let i = 0; i < 3 && (time.charAt(0) === "0" || time.charAt(0) === ":"); i++)
            time = time.substring(1);
        return time;
    }

    private getPlayerTeam(playerName: string): Team | undefined {
        return this.teams.find(x => x.players.some(player => player.name === playerName));
    }

    private getPlayer(playerName: string): Player | undefined {
        return this.getPlayerTeam(playerName)?.players.find(x => x.name === playerName);
    }
}