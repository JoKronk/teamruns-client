import { LocalPlayerData } from "../user/local-player-data";
import { Player } from "../player/player";
import { RunMode } from "./run-mode";
import { RunData } from "./run-data";
import { GameState } from "../opengoal/game-state";
import { GameTask } from "../opengoal/game-task";
import { Task } from "../opengoal/task";
import { Team } from "./team";
import { Timer } from "./timer";
import { PlayerState } from "../player/player-state";
import { RunState } from "./run-state";
import { MultiLevel } from "../opengoal/levels";
import { OG } from "../opengoal/og";
import { UserBase } from "../user/user";
import { TimerService } from "src/app/services/timer.service";
import { UserService } from "src/app/services/user.service";
import { RunStateMapper } from "../level/run-state-mapper";

export class Run {
    data: RunData;
    teams: Team[] = [];
    spectators: Player[] = [];

    constructor(runData: RunData, public timer: TimerService) {
        this.data = runData;
        this.timer.setStartConditions(this.data.countdownSeconds);

        if (this.data.teams > 1) {
            for (let i = 0; i < this.data.teams; i++)
                this.teams.push(new Team(i, "Team " + (i + 1)));
        }
        else
            this.teams.push(new Team(0, "Team"));
    }

    removePlayer(playerId: string): void {
        let team = this.getPlayerTeam(playerId);
        if (!this.timer.runIsOngoing()) {
            this.spectators = this.spectators.filter(x => x.user.id !== playerId);
            if (!team) return;
            team.players = team.players.filter(x => x.user.id !== playerId);
        }
        else {
            let runplayer = this.getPlayer(playerId);
            if (!runplayer) return;
            if (team)
                runplayer.state = PlayerState.Disconnected;
            else
                this.spectators = this.spectators.filter(x => x.user.id !== playerId);
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
        if (this.everyoneHasFinished() || (!forfeit && this.isMode(RunMode.Lockout)))
            this.timer.runState = RunState.Ended;
    }

    everyoneHasFinished(): boolean {
        return this.teams.every(x => x.players.every(y => y.state === PlayerState.Finished || y.state === PlayerState.Forfeit));
    }

    endTeamRun(task: GameTask): void {
        let team = this.getPlayerTeam(task.user.id);
        if (!team) return;
        if (team.players.every(y => y.state === PlayerState.Finished))
            team.endTimeMs = Timer.timeToMs(task.timerTime);
    }

    endAllTeamsRun(task: GameTask): void {
        this.teams.forEach((team, index) => {
            this.teams[index].endTimeMs = Timer.timeToMs(task.timerTime);
        });
    }

    updateState(playerId: string, state: GameState, userService: UserService): void {
        let player = this.getPlayer(playerId);
        if (!player) return;

        if (!player.gameState.debugModeActive && state.debugModeActive)
            userService.sendNotification(player.user.name + " just activated debug mode!");

        player.gameState = state;

        if (state.debugModeActive) {
            const team = this.getPlayerTeam(playerId);
            if (team) team.hasUsedDebugMode = true;
        }
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
        if (!this.data.normalCellCost && (this.isMode(RunMode.Lockout) || (this.getPlayerTeam(playerId)?.players.length ?? 0) > 1)) {
            OG.runCommand("(set! (-> *GAME-bank* money-task-inc) 180.0)");
            OG.runCommand("(set! (-> *GAME-bank* money-oracle-inc) 240.0)");
        }
        else {
            OG.runCommand("(set! (-> *GAME-bank* money-task-inc) 90.0)");
            OG.runCommand("(set! (-> *GAME-bank* money-oracle-inc) 120.0)");
        }
    }

    changeTeam(user: UserBase | undefined, teamId: number) {
        if (!user) return;
        let newTeam = this.getTeam(teamId);
        if (!newTeam) return;
    
        let oldTeam = this.getPlayerTeam(user.id);
        let player = oldTeam ? oldTeam.players.find(x => x.user.id === user.id) : new Player(user);
        newTeam.players.push(player!);
        this.spectators = this.spectators.filter(x => x.user.id !== user.id);

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

    getTeam(teamId: number): Team | undefined {
        return this.teams.find(x => x.id === teamId);
    }

    getPlayerTeam(playerId: string): Team | undefined {
        return this.teams.find(x => x.players.some(player => player.user.id === playerId));
    }

    getPlayer(playerId: string): Player | undefined {
        return this.getPlayerTeam(playerId)?.players.find(x => x.user.id === playerId) ?? this.spectators.find(x => x.user.id === playerId);
    }

    getAllPlayers(): Player[] {
        return this.teams.flatMap(x => x.players);
    }

    getAllTasks(): Task[] {
        return this.teams.flatMap(x => x.tasks);
    }

    getPlayerTasks(playerId: string): Task[] {
        return this.getPlayerTeam(playerId)?.tasks.filter(x => x.obtainedById === playerId) ?? [];
    }


    playerTeamHasCell(task: string, playerId: string): boolean {
        return this.getPlayerTeam(playerId)?.hasTask(task) ?? false;
    }

    runHasCell(task: string): boolean {
        return this.teams.some(x => x.tasks.some(y => y.gameTask === task));
    }

    hasSpectator(playerId: string): boolean {
        return this.spectators.find(x => x.user.id === playerId) !== undefined;
    }

    isMode(mode: RunMode): boolean {
        return this.data.mode === mode;
    }


    // --- RUN METHODS INVOLVING OPENGOAL ---

    //used to sync runs between players for user join or in case of desync
    importTaskChanges(localPlayer: LocalPlayerData, run: Run) {

        //handle team events
        this.teams.forEach(team => {
            let importTeam = run.teams.find(x => x.id === team.id);
            if (importTeam) {
                //localPlayer player class, use to check if this is curernt players TEAM
                let theLocallyImportedPlayer = team.players.find(x => x.user.id === localPlayer.user.id);
                //check for new tasks to give player
                if (theLocallyImportedPlayer || this.isMode(RunMode.Lockout)) {
                    importTeam.tasks.filter(x => x.isCell && !team.tasks.some(({ gameTask: task }) => task === x.gameTask)).forEach(task => {
                        OG.updateTask(new GameTask(task.gameTask, new UserBase(task.obtainedById, task.obtainedByName), task.obtainedAt));
                    });
                }

                //transfer tasks
                team.tasks = importTeam.tasks;
                team.cellCount = importTeam.cellCount;

                //state update checks
                if (theLocallyImportedPlayer) {
                    this.updateSelfRestrictions(localPlayer, theLocallyImportedPlayer);
                }
            }
        });
    }

    updateSelfRestrictions(localPlayer: LocalPlayerData, player: Player | undefined = undefined) {
        if (!player)
            player = this.getPlayer(localPlayer.user.id);
        if (!player) return;
        const team = this.getPlayerTeam(player.user.id);
        if (!team) return;

        let levelToCheck = player.gameState.currentLevel;

        //if all on same level hub zoomer
        if (!localPlayer.restrictedZoomerLevels.includes(player.gameState.currentLevel) || team.players.every(x => x.gameState.onZoomer && x.gameState.currentLevel === levelToCheck) || this.isMode(RunMode.Lockout) && this.teams.length === 1) {
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
            const assignedTeam = Object.assign(new Team(team.id, team.name), team);
            assignedTeam.runState = Object.assign(new RunStateMapper(), assignedTeam.runState);
            teams.push(assignedTeam);
        }
        this.teams = teams;
        return this;
    }

    reconstructTimer(timer: TimerService) {
        this.timer = timer;
        if (this.timer.runIsOngoing())
            this.timer.updateTimer();

    }
}