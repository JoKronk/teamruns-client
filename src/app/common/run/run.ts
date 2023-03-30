import { LocalPlayerData } from "../user/local-player-data";
import { Player } from "../player/player";
import { RunMode } from "./run-mode";
import { RunData } from "./run-data";
import { GameState } from "../player/game-state";
import { Task } from "../opengoal/task";
import { Team } from "./team";
import { Timer } from "./timer";
import { PlayerState } from "../player/player-state";
import { RunState } from "./run-state";
import { MultiLevel } from "../opengoal/levels";
import { OG } from "../opengoal/og";
import { UserBase } from "../user/user";

export class Run {
    data: RunData;
    teams: Team[];
    timer: Timer;

    constructor(runData: RunData) {
        this.data = runData;
        this.teams = [];
        this.timer = new Timer(this.data.countdownSeconds);

        for (let i = 0; i < this.data.teams; i++)
            this.teams.push(new Team("Team " + (i + 1)));
    }

    removePlayer(playerId: string): void {
        if (!this.timer.runIsOngoing()) {
            let team = this.getPlayerTeam(playerId);
            if (!team) return;
            team.players = team.players.filter(x => x.user.id !== playerId);
        }
        else {
            let runplayer = this.getPlayer(playerId);
            if (!runplayer) return;
            runplayer.state = PlayerState.Disconnected;
        }
    }

    toggleVoteReset(playerId: string, state: PlayerState): boolean {
        let player = this.getPlayer(playerId);
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
            team.resetForRun();
        });
        return true;
    }

    endPlayerRun(playerId: string, forfeit: boolean): void {
        let player = this.getPlayer(playerId);
        if (!player) return;
        player.state = forfeit ? PlayerState.Forfeit : PlayerState.Finished;
        if (this.everyoneHasFinished() || (!forfeit && this.data.mode === RunMode.Lockout))
            this.timer.runState = RunState.Ended;
    }

    everyoneHasFinished(): boolean {
        return this.teams.every(x => x.players.every(y => y.state === PlayerState.Finished || y.state === PlayerState.Forfeit));
    }

    updateState(playerId: string, state: GameState): void {
        let player = this.getPlayer(playerId);
        if (!player) return;
        player.gameState = state;
    }

    reconnectPlayer(playerId: string) {
        let player = this.getPlayer(playerId);
        if (!player) return;
        player.state = PlayerState.Ready;
    }

    addSplit(task: Task): void {
            this.getPlayerTeam(task.obtainedById)?.addTask(task);
    }

    toggleReady(playerId: string, state: PlayerState): void {
        let player = this.getPlayer(playerId);
        if (!player) return;
        player.state = state;
    }

    everyoneIsReady(): boolean {
        return this.teams.every(x => x.players.every(y => y.state === PlayerState.Ready));
    }

    start(startDate: Date) {
        startDate.setSeconds(startDate.getSeconds() + this.timer.countdownSeconds - 1);
        this.timer.startTimer(startDate.getTime());
        OG.runCommand("(start 'play (get-continue-by-name *game-info* \"village1-hut\"))");
    }

    setOrbCosts(playerId: string) {
        if (!this.data.normalCellCost && (this.data.mode === RunMode.Lockout || (this.getPlayerTeam(playerId)?.players.length ?? 0) > 1)) {
            OG.runCommand("(set! (-> *GAME-bank* money-task-inc) 180.0)");
            OG.runCommand("(set! (-> *GAME-bank* money-oracle-inc) 240.0)");
        }
        else {
            OG.runCommand("(set! (-> *GAME-bank* money-task-inc) 90.0)");
            OG.runCommand("(set! (-> *GAME-bank* money-oracle-inc) 120.0)");
        }
    }

    changeTeam(user: UserBase, teamName: string) {
      let newTeam = this.getTeam(teamName);
      if (!newTeam) return;
  
      let oldTeam = this.getPlayerTeam(user.id);
      let player = oldTeam ? oldTeam.players.find(x => x.user.id === user.id) : new Player(user);
      newTeam.players.push(player!);

      //cheap method of forcing screen to re-render old team
      if (oldTeam) {
        let players = oldTeam.players.filter(x => x.user.id !== user.id);
        oldTeam.players = [];
        oldTeam.players = players;
      }
    }
    
    getTimerShortenedFormat(): string {
        let time = this.timer.time + this.timer.timeMs;
        for (let i = 0; i < 3 && (time.charAt(0) === "0" || time.charAt(0) === ":"); i++)
            time = time.substring(1);
        return time;
    }

    getTeam(teamName: string): Team | undefined {
        return this.teams.find(x => x.name === teamName);
    }

    getPlayerTeam(playerId: string): Team | undefined {
        return this.teams.find(x => x.players.some(player => player.user.id === playerId));
    }

    getPlayer(playerId: string): Player | undefined {
        return this.getPlayerTeam(playerId)?.players.find(x => x.user.id === playerId);
    }

    getAllTask(): Task[] {
        return this.teams.flatMap(x => x.tasks);
    }


    playerTeamHasCell(task: string, playerId: string): boolean {
        return this.getPlayerTeam(playerId)?.tasks.some(x => x.gameTask === task) ?? false;
    }

    runHasCell(task: string): boolean {
        return this.teams.some(x => x.tasks.some(y => y.gameTask === task));
    }


    // --- RUN METHODS INVOLVING OPENGOAL ---

    //used to sync runs between players for user join or in case of desync
    importTaskChanges(localPlayer: LocalPlayerData, run: Run) {

        //handle team events
        this.teams.forEach(team => {
            let importTeam = run.teams.find(x => x.name === team.name);
            if (importTeam) {
                //localPlayer player class, use to check if this is curernt players TEAM
                let localImportedPlayer = team.players.find(x => x.user.id === localPlayer.user.id);
                //check for new tasks to give player
                if (localImportedPlayer || this.data.mode === RunMode.Lockout) {
                    importTeam.tasks.filter(x => x.isCell && !team.tasks.some(({ gameTask: task }) => task === x.gameTask)).forEach(task => {
                        this.giveCellToUser(task, localImportedPlayer);
                    });
                }

                //transfer tasks
                team.tasks = importTeam.tasks;
                team.cellCount = importTeam.cellCount;

                //state update checks
                if (localImportedPlayer) {
                    this.onUserStateChange(localPlayer, localImportedPlayer);
                }
            }
        });
    }

    giveCellToUser(task: Task, player: Player | undefined) {
        if (!player || !task.isCell) return;

        if ((this.getPlayerTeam(task.obtainedById)?.name === this.getPlayerTeam(player.user.id)?.name || this.data.mode === RunMode.Lockout)) {
            let fuelCell = Task.getEnameMap().get(task.gameTask);
            if (fuelCell)
                OG.runCommand('(+! (-> (the fuel-cell (process-by-ename "' + fuelCell + '")) base y) (meters -200.0))');
            OG.giveCell(task.gameTask);
        }
    }

    onUserStateChange(localPlayer: LocalPlayerData, player: Player) {
        const team = this.getPlayerTeam(player.user.id);
        if (!team) return;

        let levelToCheck = team.players[0]?.gameState.currentLevel;

        //if all on same level hub zoomer
        if (!localPlayer.restrictedZoomerLevels.includes(player.gameState.currentLevel) || team.players.every(x => x.gameState.onZoomer && x.gameState.currentLevel === levelToCheck) || this.data.mode === RunMode.Lockout && this.teams.length === 1) {
            OG.runCommand("(set-zoomer-full-mode)");
            localPlayer.restrictedZoomerLevels = localPlayer.restrictedZoomerLevels.filter(x => x !== player!.gameState.currentLevel);
        }
        else if (!this.data.allowSoloHubZoomers)
            OG.runCommand("(set-zoomer-wait-mode)");

        if (this.data.requireSameLevel) {
            if (team.players.every(x => this.isSameLevel(x.gameState.currentLevel, levelToCheck)))
                OG.runCommand("(set! *allow-cell-pickup?* #t)");
            else 
                OG.runCommand("(set! *allow-cell-pickup?* #f)");
        }
    }

    private isSameLevel(currentLevel: string, checkAgainst: string) {
        if (MultiLevel.spiderCave().includes(currentLevel) && MultiLevel.spiderCave().includes(checkAgainst))
            return true;
        if (MultiLevel.jungle().includes(currentLevel) && MultiLevel.jungle().includes(checkAgainst))
            return true;
        if (MultiLevel.lpc().includes(currentLevel) && MultiLevel.lpc().includes(checkAgainst))
            return true;
        if (currentLevel === checkAgainst)
            return true;

        return false;
    }

    reconstructRun() {
        //update run
        let teams: Team[] = [];
        for (let team of this.teams) {
            teams.push(Object.assign(new Team(team.name), team));
        }
        this.teams = teams;
        this.timer = Object.assign(new Timer(this.timer.countdownSeconds), this.timer);
        if (this.timer.runIsOngoing())
            this.timer.updateTimer();

        return this;
    }
}