import { Player } from "../player/player";
import { RunMod, RunMode } from "./run-mode";
import { RunData } from "./run-data";
import { GameState } from "../opengoal/game-state";
import { GameTaskLevelTime } from "../opengoal/game-task";
import { Task } from "../opengoal/task";
import { Team } from "./team";
import { Timer } from "./timer";
import { PlayerState } from "../player/player-state";
import { RunState } from "./run-state";
import { UserBase } from "../user/user";
import { UserService } from "src/app/services/user.service";
import { RunStateHandler } from "../level/run-state-handler";
import { RemotePlayerInfo } from "../socket/remote-player-info";
import { CategoryOption } from "./category";
import { PlayerType } from "../player/player-type";

export class Run {
    data: RunData;
    forPracticeTool: boolean;
    teams: Team[] = [];
    spectators: Player[] = [];
    timer: Timer = new Timer();

    isFFA: boolean = false;

    constructor(runData: RunData, isPracticeTool: boolean | undefined = undefined) {
        this.data = runData;
        this.forPracticeTool = isPracticeTool === undefined ? false : isPracticeTool;
        this.timer.setStartConditions(this.data.countdownSeconds);

        if (this.data.teams > 1) {
            for (let i = 0; i < this.data.teams; i++)
                this.teams.push(new Team(i, "Team " + (i + 1)));
        }
        else
            this.teams.push(new Team(0, "Team"));

        this.isFFA = this.data.teams === 1 && RunMod.singleTeamEqualsFFA(this.data.mode);
    }

    removePlayer(playerId: string | undefined): void {
        if (playerId === undefined)
            return;
        
        let team = this.getPlayerTeam(playerId);
        if (!this.timer.runIsOngoing()) {
            this.spectators = this.spectators.filter(x => x.user.id !== playerId);
            if (!team) return;
            team.players = team.players.filter(x => x.user.id !== playerId);
        }
        else {
            let runplayer = this.getPlayer(playerId);
            if (!runplayer) return;
            if (team) {
                runplayer.state = PlayerState.Disconnected;
                team.checkMarkRunInvalid(false, "Lobby disconnect mid run.");
            }
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

    checkForRunReset(forceReset: boolean = false): boolean {
        if (!forceReset) {
            let players = this.teams.flatMap(x => x.players);
            if (players.filter(x => x.state === PlayerState.WantsToReset).length / players.length <= 0.65)
                return false;
        }
        
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
        if (this.everyoneHasFinished())
            this.timer.runState = RunState.Ended;
    }

    everyoneHasFinished(team: Team | undefined = undefined): boolean {
        if (team === undefined) {
            if (RunMod.endRunOnSiglePlayerFinish(this.data.mode) && this.teams.some(x => x.players.some(y => y.state === PlayerState.Finished)))
                return true;
            
            return this.teams.every(x => x.players.every(y => y.state === PlayerState.Finished || y.state === PlayerState.Forfeit));
        }
        else {
            if (RunMod.endRunOnSiglePlayerFinish(this.data.mode) && team.players.some(y => y.state === PlayerState.Finished))
                return true;
            
            return team.players.every(y => y.state === PlayerState.Finished || y.state === PlayerState.Forfeit);
        }
    }

    endTeamRun(task: GameTaskLevelTime): void {
        let team = this.getPlayerTeam(task.user.id);
        if (!team) return;
        if (team.players.every(y => y.state === PlayerState.Finished))
            team.endTimeMs = Timer.timeToMs(task.timerTime);
    }

    endAllTeamsRun(task: GameTaskLevelTime): void {
        this.teams.forEach((team, index) => {
            this.teams[index].endTimeMs = Timer.timeToMs(task.timerTime);
        });
        this.timer.runState = RunState.Ended;
    }

    updateState(playerId: string, state: GameState, player: Player | undefined = undefined): void {
        if (!player)
            player = this.getPlayer(playerId);
        if (!player) return;

        const oldCheckpoint = player.gameState.currentCheckpoint;
        player.gameState = state;
        if (!state.currentCheckpoint)
            player.gameState.currentCheckpoint = oldCheckpoint;

        if (state.debugModeActive && this.timer.isPastCountdown()) {
            const team = this.getPlayerTeam(playerId);
            if (team) team.checkMarkRunInvalid(false, "Debug mode used.");
        }
    }

    reconnectPlayer(playerId: string) {
        let player = this.getPlayer(playerId);
        if (!player) return;
        player.state = PlayerState.Ready;
    }

    addSplit(task: Task): void {
            this.getPlayerTeam(task.obtainedById)?.addSplit(task);
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
    }

    changeTeam(user: UserBase | undefined, teamId: number) {
        if (!user) return;
        let newTeam = this.getTeam(teamId);
        if (!newTeam) return;
    
        let oldTeam = this.getPlayerTeam(user.id);
        if (newTeam === oldTeam) return;

        if (this.timer.runIsOngoing()) 
            newTeam.checkMarkRunInvalid(false, "Team change mid run.");
        
        let player = (oldTeam ? oldTeam.players.find(x => x.user.id === user.id) : this.spectators.find(x => x.user.id === user.id));
        if (player === undefined) {
            player = new Player(user, PlayerType.GuestUser);
            console.log("Found non existent user!");
        }
        newTeam.players.push(player!);
        this.spectators = this.spectators.filter(x => x.user.id !== user.id);

        //cheap method of forcing screen to re-render old team
        if (oldTeam && oldTeam.id !== newTeam.id) {
            let players = oldTeam.players.filter(x => x.user.id !== user.id);
            oldTeam.players = [];
            oldTeam.players = players;
        }
    }
    
    getTimerShortenedFormat(): string {
        let time = this.timer.timeString + this.timer.timeStringMs;
        for (let i = 0; i < 3 && (time.charAt(0) === "0" || time.charAt(0) === ":"); i++)
            time = time.substring(1);
        return time;
    }

    getTeam(teamId: number): Team | undefined {
        return this.teams.find(x => x.id === teamId);
    }

    getPlayerTeam(playerId: string, giveUniqueTeamIfFFA: boolean = false): Team | undefined {
        if (giveUniqueTeamIfFFA && this.isFFA) {
            return new Team(0, "Local FFA Team");
        }
        else 
            return this.teams.find(x => x.players.some(player => player.user.id === playerId));
    }

    getPlayer(playerId: string): Player | undefined {
        return this.getPlayerTeam(playerId)?.players.find(x => x.user.id === playerId) ?? this.spectators.find(x => x.user.id === playerId);
    }

    getAllPlayers(): Player[] {
        return this.teams.flatMap(x => x.players);
    }

    getAllSplits(): Task[] {
        return this.teams.flatMap(x => x.splits);
    }

    getPlayerSplits(playerId: string): Task[] {
        return this.getPlayerTeam(playerId)?.splits.filter(x => x.obtainedById === playerId) ?? [];
    }

    playerTeamHasSplit(taskName: string, playerId: string): boolean {
        return this.getPlayerTeam(playerId)?.hasSplit(taskName) ?? false;
    }

    hasSplit(taskName: string): boolean {
        return this.teams.some(x => x.splits.some(y => y.gameTask === taskName));
    }

    hasSpectator(playerId: string): boolean {
        return this.spectators.find(x => x.user.id === playerId) !== undefined;
    }

    isMode(mode: RunMode): boolean {
        return this.data.mode === mode;
    }

    checkRunEndValid(): undefined {
        for (let team of this.teams) {
            if (!team.runIsValid)
                continue;

            if (team.players.some(x => x.state === PlayerState.Forfeit)) {
                team.checkMarkRunInvalid(false, "Forfeit.");
                continue;
            }

            switch (this.data.category) {
                case CategoryOption.NoLts:
                    team.checkMarkRunInvalid(team.runState.cellCount >= 72, "Run invalid, only " + team.runState.cellCount + " cells registered.");
                    break;
                case CategoryOption.AllCells:
                    team.checkMarkRunInvalid(team.runState.cellCount === 101, "Run invalid, only " + team.runState.cellCount + " cells registered.");
                    break;
                case CategoryOption.Hundo:
                    team.checkMarkRunInvalid(team.runState.cellCount === 101 && team.runState.totalOrbCount === 2000, team.runState.totalOrbCount !== 2000 ? 
                        "Run invalid, only " + team.runState.totalOrbCount + " orbs registered." : 
                        "Run invalid, only " + team.runState.cellCount + " cells registered."
                    );
                    break;
                case CategoryOption.NoFcs:
                    team.checkMarkRunInvalid(team.runState.cellCount >= 22, "Run invalid, only " + team.runState.cellCount + " cells registered.");
                    break;
                case CategoryOption.Orbless:
                    team.checkMarkRunInvalid(team.runState.totalOrbCount === 0, "Run invalid " + team.runState.totalOrbCount + "orbs registered.");
                    break;
                case CategoryOption.AllFlies:
                    team.checkMarkRunInvalid(team.runState.buzzerCount === 112, "Run invalid, only " + team.runState.buzzerCount + " scoutflies registered.");
                    break;
                case CategoryOption.AllOrbs:
                    team.checkMarkRunInvalid(team.runState.totalOrbCount === 2000, "Run invalid, only " + team.runState.totalOrbCount + " orbs registered.");
                    break;
                default:
                    team.checkMarkRunInvalid(false, "Run invalid, category is not a registered speedrun category.");
                    break;
            }
        }
        return;
    }

    getRemotePlayerInfo(userId: string): RemotePlayerInfo | undefined {
        let playerIndex = 0;
        let playerInfo: RemotePlayerInfo | undefined = undefined;
        for (let team of this.teams) {
            for (let player of team.players) {
                if (player.user.id === userId) {
                    playerInfo = new RemotePlayerInfo(team.id, playerIndex, player.cellsCollected);
                    break;
                }
                playerIndex += 1;
            }
            if (playerInfo)
                break;
        }
        return playerInfo;
    }


    // --- RUN METHODS INVOLVING OPENGOAL ---
    reconstructRun() {
        //update run
        let teams: Team[] = [];
        for (let team of this.teams) {
            const assignedTeam = Object.assign(new Team(team.id, team.name), team);
            assignedTeam.runState = Object.assign(new RunStateHandler(), assignedTeam.runState);
            teams.push(assignedTeam);
        }
        this.teams = teams;
        return this;
    }

    reconstructTimer(timer: Timer) {
        this.timer = timer;
        if (this.timer.runIsOngoing())
            this.timer.updateTimer();

    }
}