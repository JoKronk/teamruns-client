
import { WebSocketSubject, webSocket } from "rxjs/webSocket";
import { Recording } from "../recording/recording";
import { UserRecording } from "../recording/user-recording";
import { UserPositionData } from "./position-data";
import { RecordingPositionData } from "../recording/recording-position-data";
import { User, UserBase } from "../user/user";
import { MultiplayerState } from "../opengoal/multiplayer-state";
import { InteractionType } from "../opengoal/interaction-type";
import { Timer } from "../run/timer";
import { InteractionData, UserInteractionData } from "./interaction-data";
import { CurrentPositionData } from "./current-position-data";
import { CurrentPlayerData } from "./current-player-data";
import { GameTaskLevelTime } from "../opengoal/game-task";
import { Task } from "../opengoal/task";
import { PlayerState } from "../player/player-state";
import { TaskStatus } from "../opengoal/task-status";
import { RunMod, RunMode } from "../run/run-mode";
import { Run } from "../run/run";
import { RunCleanupHandler } from "../level/run-cleanup-handler";
import { RunState } from "../run/run-state";
import { NgZone } from "@angular/core";
import { RemotePlayerInfo } from "./remote-player-info";
import { SocketPackage } from "./socket-package";
import { OgCommand } from "./og-command";
import { GameSettings } from "./game-settings";
import { Team } from "../run/team";
import { OG } from "../opengoal/og";
import pkg from 'app/package.json';
import { LocalSave } from "../level/local-save";
import { TimerPackage } from "./timer-package";
import { ShortMemoryInteraction } from "./short-memory-interaction";
import { RunData } from "../run/run-data";
import { Subscription } from "rxjs";
import { DbLeaderboardPb } from "../firestore/db-leaderboard-pb";

export class SocketHandler {

    recordings: Recording[] = [];
    private userPositionRecordings: UserRecording[] = [];

    timer: Timer;
    run: Run;
    localTeam: Team | undefined;
    previousPb: DbLeaderboardPb | undefined = undefined;

    protected isLocalMainPlayer: boolean = true;

    inMidRunRestartPenaltyWait: number = 0;
    isSyncing: boolean = false;
    
    protected self: CurrentPlayerData;
    protected players: CurrentPlayerData[] = [];
    private drawPositions: boolean = false;
    private positionUpdateRateMs: number = 8;
    
    private shortTermInteractionMemory: ShortMemoryInteraction[] = [];

    private sendingCommands: boolean;
    private socketCommandBuffer: OgCommand[] = []; 
    private socketPackage: SocketPackage = new SocketPackage();
    public socketConnected: boolean;
    ogSocket: WebSocketSubject<any> = webSocket('ws://localhost:8111');
    private launchListener: any;
    private shutdownListener: any;
    private connectionAttempts: number;
    private timerSubscription: Subscription;


    constructor(public socketPort: number, public user: User, run: Run, public cleanupHandler: RunCleanupHandler, public zone: NgZone) {
        this.ogSocket = webSocket('ws://localhost:' + socketPort);

        this.run = run;
        this.timer = run.timer;
        this.isLocalMainPlayer = socketPort === OG.mainPort;
        this.localTeam = run.getPlayerTeam(user.id, !this.isLocalMainPlayer);

        if (this.user.name) //if client is fully reloaded in a place where position service is started at same time as use we pick up user on movement instead
            this.checkRegisterPlayer(this.user.getUserBaseWithDisplayName(), MultiplayerState.interactive);

        this.launchListener = (window as any).electron.receive("og-launched", (port: number) => {
            if (port == this.socketPort) {
                this.connectionAttempts = 0;
                this.user.gameLaunched = true;
                this.connectToOpengoal();
                this.changeController(this.user.controllerPort ?? 0);
            }

        });

        this.shutdownListener = (window as any).electron.receive("og-closed", (port: number) => {
            if (port == this.socketPort) {
                (window as any).electron.send('logs-fetch');
                this.inMidRunRestartPenaltyWait = 0;
                this.isSyncing = false
                this.socketConnected = false;
                this.socketCommandBuffer = [];
                this.socketPackage.timer = undefined;
                this.self.interactionBuffer = [];
                this.players.forEach(player => {
                    player.checkUpdateUsername("");
                });
                this.ogSocket.complete();
                this.ogSocket = webSocket('ws://localhost:' + socketPort);
            }

        });
        
      this.timerSubscription = this.timer.timerSubject.subscribe(state => {
        switch(state) {
            case RunState.Countdown:
                if (!this.run.forPracticeTool)
                    this.addCommand(OgCommand.SetupRun);

                if (this.timer.countdownSeconds > 1)
                    this.addCommand(OgCommand.TargetGrab);

                this.resetOngoingRecordings();
                this.cleanupHandler.resetHandler();
                this.updateGameSettings(new GameSettings(this.run?.data));
                this.setAllRealPlayersMultiplayerState();
                break;

            case RunState.CountdownSpawning:
                if (!this.run.forPracticeTool)
                    this.addCommand(OgCommand.StartRun);
                break;

            case RunState.Started:
                this.addCommand(OgCommand.TargetRelease);
                break;

            default:
                break;
        }
      });
    }

    private connectToOpengoal() {
        this.ogSocket.subscribe(target => {

            if (target.connected && !this.socketConnected) {
                this.socketPackage.version = "v" + pkg.version;
                this.socketPackage.username = this.user.displayName;

                //handle mid game restarts
                if (this.run?.timer.runState !== RunState.Waiting && RunMod.usesMidGameRestartPenaltyLogic(this.run.data.mode)) {
                    this.inMidRunRestartPenaltyWait = 10;
                    this.isSyncing = false;
                    this.addCommand(OgCommand.DisableDebugMode);
                    const lastCheckpoint = this.run?.getPlayer(this.user.id)?.gameState.currentCheckpoint;
                    if (lastCheckpoint) this.forceCheckpointSpawn(lastCheckpoint);

                    setTimeout(() => {
                        this.inMidRunRestartPenaltyWait = 0;
                        this.isSyncing = false;
                        this.addCommand(OgCommand.TargetRelease);
                    }, (this.inMidRunRestartPenaltyWait * 1000));
                }

                setTimeout(() => { //give the game a bit of time to actually start
                    console.log("Socket Connected!");
                    this.zone.run(() => {
                        this.socketConnected = true;
                    });
                    this.updateGameSettings(new GameSettings(this.timer.isPastCountdown() ? this.run.data : RunData.getFreeroamSettings(pkg.version, !this.run.forPracticeTool)));
                    this.run.getAllPlayers().forEach(player => { // set the team for any users already connected
                        this.updatePlayerInfo(player.user.id, this.run.getRemotePlayerInfo(player.user.id));
                    });
                    this.repeatPlayerUsernames();

                    this.addCommand(OgCommand.None); //send empty message to update username, version & controller
                }, 300);
            }

            if (target.position)
                this.updatePlayerPosition(new UserPositionData(target.position, this.timer.totalMs, this.user));

            if (target.state) {
                if (target.state.justSpawned) {
                    if (this.timer.runState === RunState.Countdown)
                        this.addCommand(OgCommand.TargetGrab);
                }
                //local save logic
                if (target.state.justSaved && this.run.data.mode === RunMode.Casual && this.timer.totalMs > 5000) {
                    let save: LocalSave = (this.localTeam?.runState ?? this.run.getTeam(0)?.runState) as LocalSave;
                    if (save.cellCount !== 0 || save.orbCount !== 0 || save.buzzerCount !== 0) {
                        save.name = this.run.data.name;
                        save.users = this.localTeam?.players.flatMap(x => x.user) ?? [];
                        (window as any).electron.send('save-write', save);
                    }
                }
            }

            /*
            if (target.state) {
              console.log(target.state)
            }*/

            if (target.levels)
                this.localTeam?.runState.onLevelsUpdate(target.levels, this);
        },
        error => {
            if (this.connectionAttempts < 4) {
                this.connectionAttempts += 1;
                setTimeout(() => {
                    if (this.connectionAttempts != 0)
                        this.connectToOpengoal();
                }, 3000);
            }
            else
                console.log("Opengoal socket error, did the game shut down?");
        });
    }

    resetGetRecordings(): UserRecording[] {
        const recordings = this.userPositionRecordings;
        this.cleanupPlayers();

        this.resetOngoingRecordings();
        this.recordings = [];
        return recordings;
    }

    resetOngoingRecordings() {
        this.userPositionRecordings = [];
    }

    changeController(controllerPort: number) {
        this.socketPackage.controllerPort = controllerPort;
        this.user.controllerPort = controllerPort;
        this.addCommand(OgCommand.None);
    }

    setPreviousPb(pb: DbLeaderboardPb) {
        this.previousPb = Object.assign(new DbLeaderboardPb(), pb);
    }

    addCommand(command: OgCommand) {
        this.socketCommandBuffer.push(command);
        this.sendCommandsFromBuffer();
    }

    private async sendCommandsFromBuffer(initStart: boolean = true) {
        if (initStart && this.sendingCommands) //prevent commands from being sent to quickly
            return;

        if (this.socketCommandBuffer.length === 0 || this.drawPositions && !this.socketConnected) {
            this.sendingCommands = false;
            return;
        }
        
        this.sendingCommands = true;

        this.sendSocketPackageToOpengoal(false);
        await new Promise(r => setTimeout(r, (this.positionUpdateRateMs * 2)));
        this.sendCommandsFromBuffer(false);
    }

    forceCheckpointSpawn(checkpoint: string) {
        this.socketPackage.forceContinue = checkpoint;
    }

    private addRecordingInteractionToBuffer(currentPlayer: CurrentPlayerData, positionData: RecordingPositionData) {
        if (currentPlayer.positionData.mpState === MultiplayerState.interactive && positionData.iT && positionData.iT !== InteractionType.none)
            currentPlayer.interactionBuffer.push(InteractionData.getRecordingInteractionValues(positionData));
    }

    addPlayerInteraction(interaction: UserInteractionData) {
        const player = this.self.positionData.userId === interaction.userId ? this.self : this.players.find(x => x.positionData.userId == interaction.userId) ?? this.self; //assume its sync data of missing user and give to self if none found
        if (!player || interaction.interType === InteractionType.none) return;
        player.interactionBuffer.push(InteractionData.getInteractionValues(interaction));
    }

    updatePlayerInfo(userId: string, playerInfo: RemotePlayerInfo | undefined) {
        if (!playerInfo) return;

        if (!this.self)
            this.checkRegisterPlayer(this.user.getUserBaseWithDisplayName(), MultiplayerState.interactive);

        if (this.self.positionData.userId === userId)
            this.socketPackage.selfInfo = playerInfo;
        else {
            const player = this.players.find(x => x.positionData && x.positionData.userId == userId);
            if (!player) return;
            player.positionData.playerInfo = playerInfo;
        }
        if (!this.drawPositions)
            this.addCommand(OgCommand.None);
    }

    repeatPlayerUsernames() {
        for (let player of this.players)
            player.positionData.updateUsername(player.currentUsername);
    }

    updateGameSettings(settings: GameSettings) {
        this.socketPackage.gameSettings = settings;
        if (!this.drawPositions)
            this.addCommand(OgCommand.None);
    }

    addOrbAdjustmentToCurrentPlayer(adjustmentAmount: number, level: string | undefined = undefined) {
        const orbReductionInteraction: UserInteractionData = {
            interType: InteractionType.money,
            interAmount: adjustmentAmount,
            interStatus: 0,
            interName: "money",
            interParent: "entity-pool",
            interLevel: level ?? "none",
            interCleanup: true, //to make sure it does not run through player interaction handler
            time: 0,
            userId: this.user.id
        };
        this.addPlayerInteraction(orbReductionInteraction);
    }

    stopDrawPlayer(userId: string) {
        let player = this.players.find(x => x.positionData.userId === userId);
        if (!player) return;
        
        player.checkUpdateUsername("");
        player.positionData.mpState = MultiplayerState.disconnected;
        this.sendSocketPackageToOpengoal();

        if (!this.players.some(x => x.positionData.mpState !== MultiplayerState.disconnected))
            this.players = [];
        else
            player.positionData.onDisconnectCleanup();

        this.repeatPlayerUsernames();
    }

    private checkRegisterPlayer(user: UserBase | undefined, state: MultiplayerState) {
        if (!user || this.players.find(x => x.positionData.userId === user.id)) return;

        if (user.id !== this.user.id) {
            this.players.push(new CurrentPlayerData(user, state));
            this.updatePlayerInfo(user.id, this.run.getRemotePlayerInfo(user.id));
            this.repeatPlayerUsernames();
        }
        else
            this.self = new CurrentPlayerData(user, MultiplayerState.interactive);
    }

    addRecording(recording: Recording, state: MultiplayerState) {
        recording.state = state; //set here because rec state on import is determined by player depending on team relation which isn't known for everyone at import
        this.recordings.push(recording);
    }

    checkRemoveRecording(recordingId: string): boolean {
        let recording = this.recordings.find(x => x.id === recordingId);
        if (recording) {
            this.recordings = this.recordings.filter(x => x.id !== x.id);
            this.stopDrawPlayer(recordingId);
            return true;
        }
        return false;
    }

    setAllRealPlayersMultiplayerState() {
        this.players.forEach(player => {
            if (!this.recordings.some(x => x.id === player.positionData.userId))
                player.positionData.mpState = this.run.isMode(RunMode.Lockout) || this.localTeam?.players.some(x => x.user.id === player.positionData.userId) ? MultiplayerState.interactive : MultiplayerState.active;
        });
    }

    getSelfUserPositionData(time: number): UserPositionData | undefined {
        if (!this.self)
            this.checkRegisterPlayer(this.user.getUserBaseWithDisplayName(), MultiplayerState.interactive);
        
        if (!this.self.positionData)
            return undefined;

        return {
            transX: this.self.positionData.transX ?? 0,
            transY: this.self.positionData.transY ?? 0,
            transZ: this.self.positionData.transZ ?? 0,
            quatX: this.self.positionData.quatX ?? 0,
            quatY: this.self.positionData.quatY ?? 0,
            quatZ: this.self.positionData.quatZ ?? 0,
            quatW: this.self.positionData.quatW ?? 0,
            rotY: this.self.positionData.rotY ?? 0,
            tgtState: this.self.positionData.tgtState,
            currentLevel: this.self.positionData.currentLevel ?? "",
            interType: 0,
            interAmount: 0,
            interStatus: 0,
            interName: "",
            interParent: "",
            interLevel: "",
            interCleanup: false,
            userId: this.self.positionData.userId,
            username: this.self.currentUsername,
            time: time
        }
    }


    updatePlayerPosition(positionData: UserPositionData) {
        
        const isLocalUser = positionData.userId === this.user.id;
        let player = !isLocalUser ? this.players.find(x => x.positionData.userId === positionData.userId) : this.self;
        if (player) {
            if (player.positionData.currentLevel !== positionData.currentLevel) {
                this.addCommand(OgCommand.OnRemoteLevelUpdate);
                const runPlayer = this.run.getPlayer(player.positionData.userId);
                if (runPlayer) runPlayer.currentLevel = positionData.currentLevel;
            }
            
            player.updateCurrentPosition(positionData, positionData.username, isLocalUser);


            if (isLocalUser) { //handled in draw update cycle for remote players
                const runPlayer = this.run.getPlayer(player.positionData.userId);
                if (this.run.timer.runState === RunState.Started && runPlayer && runPlayer.state !== PlayerState.Finished && runPlayer.state !== PlayerState.Forfeit)
                this.handlePlayerInteractions(player.positionData);
            }
        }
        else
            this.checkRegisterPlayer(new UserBase(positionData.userId, positionData.username), MultiplayerState.interactive);

        if (this.timer.totalMs === 0 || !this.isLocalMainPlayer) return;

        //handle user position recording
        let userRecording = this.userPositionRecordings.find(x => x.userId === positionData.userId);

        //registner new if missing
        if (!userRecording) {
            userRecording = new UserRecording(positionData.username, positionData.userId);
            this.userPositionRecordings.push(userRecording);
        }

        userRecording.addPositionData(positionData);
    }

    startDrawPlayers() {
        if (this.drawPositions) return;
        this.drawPositions = true;
        this.recordings.forEach(recording => {
            recording.currentRecordingDataIndex = undefined;
        });
        this.drawPlayers();
        this.players.forEach(player => {
            if (player.positionData.mpState === MultiplayerState.disconnected)
                player.positionData.mpState = MultiplayerState.interactive;
        });
    }

    stopDrawPlayers() {
        this.drawPositions = false;
        this.cleanupPlayers();
    }

    private async drawPlayers() {
        if (!this.drawPositions) return;

        //handle recordings
        if (this.timer.isPastCountdown()) {
            this.recordings.forEach(recording => {
                const positionData = recording.getNextPositionData(this.timer.totalMs);
                if (positionData) {
                    const currentPlayer = this.players.find(x => x.positionData.userId === recording.id);
                    if (!currentPlayer)
                        this.checkRegisterPlayer(Recording.getUserBase(recording), recording.state);
                    else {
                        if (currentPlayer.positionData.currentLevel !== positionData.currentLevel)
                            this.addCommand(OgCommand.OnRemoteLevelUpdate);

                        const previousRecordingdataIndex = currentPlayer.recordingDataIndex ?? recording.playback.length;
                        const newRecordingdataIndex = recording.currentRecordingDataIndex;
                        if (newRecordingdataIndex && currentPlayer.updateCurrentPosition(positionData, recording.username, false, newRecordingdataIndex)) {

                            //handle missed pickups
                            if (previousRecordingdataIndex && (previousRecordingdataIndex - 1) > newRecordingdataIndex) {
                                console.log("skipped frames", previousRecordingdataIndex - newRecordingdataIndex - 1);

                                let newDataIndexHasAnimationState = positionData.tgtState !== undefined;
                                for (let i = previousRecordingdataIndex - 1; i > newRecordingdataIndex; i--) {
                                    this.addRecordingInteractionToBuffer(currentPlayer, recording.playback[i]);
                                    if (!newDataIndexHasAnimationState && recording.playback[i].tS !== undefined) { //make sure we don't skip any animation states
                                        currentPlayer.positionData.tgtState = recording.playback[i].tS;
                                        newDataIndexHasAnimationState = true;
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        //handle interaction data for run and player (handled in position update for local player)
        //needs to be done before sending data over socket for orb dupe removals
        this.players.filter(x=> x.positionData.interaction && x.positionData.interaction.interType !== InteractionType.none).forEach(player => {
            const runPlayer = this.run.getPlayer(player.positionData.userId);
            if (this.run.timer.runState === RunState.Started && runPlayer && runPlayer.state !== PlayerState.Finished && runPlayer.state !== PlayerState.Forfeit)
            this.handlePlayerInteractions(player.positionData);
        });

        //send data
        this.sendSocketPackageToOpengoal();

        //post cleanup and buffer check
        if (this.self) {
            this.self.positionData.cleanupOneTimeData();

            this.self.checkUpdateInteractionFromBuffer();
            this.socketPackage.selfInteraction = this.self.positionData.interaction; //should only be for handling orb dupes and syncing interaction
        }
        this.players.forEach(player => {
            player.positionData.cleanupOneTimeData();

            //fill interaction from buffer if possible
            player.checkUpdateInteractionFromBuffer();
        });

        await new Promise(r => setTimeout(r, this.positionUpdateRateMs));
        this.drawPlayers();
    }

    private sendSocketPackageToOpengoal(sendPlayers: boolean = true) {
        if (!this.socketConnected) return;

        if (this.socketCommandBuffer.length !== 0)
            this.socketPackage.command = this.socketCommandBuffer.shift();

        if (this.timer.isPastCountdown() && !this.run.isMode(RunMode.Casual)) {
            if (!this.socketPackage.timer) this.socketPackage.timer = new TimerPackage();
            this.socketPackage.timer.updateTime(this.timer.totalMs);
        }

        this.socketPackage.players = sendPlayers ? this.players.flatMap(x => x.positionData) : undefined;
        this.ogSocket.next(this.socketPackage);
        
        this.socketPackage.resetOneTimeValues();
    }

    private cleanupPlayers() {
        if (!this.players.some(x => x.positionData.mpState !== MultiplayerState.disconnected)) return;

        this.players.forEach(player => {
            player.checkUpdateUsername("");
            player.recordingDataIndex = undefined;
            player.positionData.mpState = MultiplayerState.disconnected;
        });

        this.sendSocketPackageToOpengoal();
        this.players = [];
    }
    
    private cleanShortTermMemory() {
        this.shortTermInteractionMemory = this.shortTermInteractionMemory.filter(x => (x.reciveTimeMs + 1000) > this.timer.totalMs);
    }
    
    private hasInteractionInMemory(interaction: UserInteractionData): boolean {
        this.cleanShortTermMemory();

        if (InteractionData.isFromOrbCollection(interaction))
            return false;

        if (this.shortTermInteractionMemory.some(x => InteractionData.areIdentical(x.interaction, interaction)))
            return true;

        return false;
    }

    private handlePlayerInteractions(positionData: CurrentPositionData) {
        if (!positionData.interaction || positionData.interaction.interType === InteractionType.none || positionData.interaction.interCleanup) return;
        const interaction = UserInteractionData.fromInteractionData(positionData.interaction, positionData.userId);
        const isSelfInteraction: boolean = positionData.userId === this.user.id;
        const playerTeam: Team | undefined = isSelfInteraction ? this.localTeam : this.run.getPlayerTeam(positionData.userId, true);
        if (!this.localTeam || !playerTeam) return;
        const isTeammate = isSelfInteraction || (playerTeam.id === this.localTeam.id && (this.run.teams.length !== 1 || !RunMod.singleTeamEqualsFFA(this.run.data.mode)));
        //interactions on game side is executed if the target the interaction belongs to is set to interactive, to avoid use positionData.resetCurrentInteraction();
        
        if (this.hasInteractionInMemory(interaction)) {
            positionData.resetCurrentInteraction();
            return;
        }
        else
            this.shortTermInteractionMemory.push(new ShortMemoryInteraction(interaction, this.timer.totalMs));

        //zoomer scoutfly pickup fix (so fast it doesn't have time to kill the box before it tries to kill the buzzer)
        if (!isSelfInteraction && interaction.interType === InteractionType.buzzer && ((this.shortTermInteractionMemory.find(x => x.interaction.interName === interaction.interParent)?.reciveTimeMs ?? 0) + 150) > this.timer.totalMs) {
            setTimeout(() => {
                this.self.interactionBuffer.push(interaction);
            }, 300);
        }
        
        switch (positionData.interaction.interType) {

            case InteractionType.gameTask:
                this.onTask(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;
        
            case InteractionType.buzzer:
                this.onBuzzer(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.money:
                this.onOrb(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.ecoBlue:
            case InteractionType.ecoYellow:
            case InteractionType.ecoGreen:
            case InteractionType.ecoRed:
                this.onEco(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.fish:
                this.onFish(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.bossPhase:
                this.onBossPhase(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.crate:
                this.onCrate(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.enemyDeath:
                this.onEnemyDeath(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.periscope:
                this.onPeriscope(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.snowBumper:
                this.onSnowBumper(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.darkCrystal:
                this.onDarkCrystal(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.lpcChamber:
                this.onLpcChamber(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

        }
    }

    
    protected onTask(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

        const task: GameTaskLevelTime = GameTaskLevelTime.fromCurrentPositionData(positionData, interaction, isSelfInteraction ? this.user.displayName : playerTeam.players.find(x => x.user.id === interaction.userId)?.user.name ?? "Unknown");

        //check duped cell buy
        if (isSelfInteraction && Task.isCellWithCost(task.name) && this.localTeam && !interaction.interCleanup && this.localTeam.runState.hasAtleastTaskStatus(interaction.interName, TaskStatus.needResolution)) {
            this.addOrbAdjustmentToCurrentPlayer((Task.cellCost(interaction)), interaction.interLevel);
            return;
        }

        //set players to act as ghosts on run end
        if (Task.isRunEnd(interaction)) {
            const player = this.players.find(x => x.positionData.userId === positionData.userId);
            if (player) player.positionData.mpState = MultiplayerState.active;
        }

        const isCell: boolean = Task.isCellCollect(interaction.interName, TaskStatus.nameFromEnum(interaction.interStatus));
        const isNewTaskStatus: boolean = playerTeam.runState.isNewTaskStatus(interaction);

        if (isCell && isNewTaskStatus) { // end run split added in EndPlayerRun event
            if (!this.run.isMode(RunMode.Casual))
                this.socketPackage.timer?.updateSplit(task, undefined);
            
            if (this,this.isLocalMainPlayer) {
                this.zone.run(() => {
                    this.run.addSplit(new Task(task));
                });
            }
        }
        this.updatePlayerInfo(positionData.userId, this.run.getRemotePlayerInfo(positionData.userId));

        //handle none current user things
        if (!isSelfInteraction && isTeammate) {

            //task updates
            if (isNewTaskStatus)
                this.cleanupHandler.onInteraction(interaction);

            //cell cost check
            if (isCell && isTeammate && !interaction.interCleanup && Task.cellCost(interaction) !== 0)
                this.addOrbAdjustmentToCurrentPlayer(-(Task.cellCost(interaction)), interaction.interLevel);
        }

        if (!isNewTaskStatus) return;
        
        //add to team run state
        if (this.isLocalMainPlayer || this.run.isFFA)
            playerTeam.runState.addTaskInteraction(interaction);
    }
    
    protected onBuzzer(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isSelfInteraction && isTeammate)
            this.cleanupHandler.onInteraction(interaction);

        if (this.isLocalMainPlayer || this.run.isFFA)
            playerTeam.runState.addBuzzerInteraction(interaction);
    }
    
    protected onOrb(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

        if (playerTeam.runState.isFalseOrb(interaction)) {
            positionData.resetCurrentInteraction();
            return;
        }
        
        let level = playerTeam.runState.getCreateLevel(interaction.interLevel);
        if (isTeammate && playerTeam.runState.checkDupeAddOrbInteraction(playerTeam.players.flatMap(x => x.user.id), this.user.id, interaction, level)) {
            if (isSelfInteraction)
                this.addOrbAdjustmentToCurrentPlayer(-1, interaction.interLevel);
            else if (!interaction.interCleanup)
                positionData.resetCurrentInteraction();

            return;
        }
        //if not orb dupe or if not part of team
        else if ((this.isLocalMainPlayer || this.run.isFFA) && !interaction.interCleanup) {
            if (playerTeam.runState.addInteraction(interaction, level)) {
                playerTeam.runState.orbCount += 1;
                playerTeam.runState.totalOrbCount += 1;
            }
        }
        
        if (!isSelfInteraction && isTeammate)
            this.cleanupHandler.onInteraction(interaction);
    }

    protected onEco(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

    }
    
    protected onFish(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

    }
    
    protected onBossPhase(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

    }
    
    protected onCrate(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!this.localTeam) return;
        if ((InteractionData.isBuzzerCrate(interaction) || InteractionData.isOrbsCrate(interaction))) {
            if (!isSelfInteraction && isTeammate)
                this.cleanupHandler.onInteraction(interaction);
    
            if (this.isLocalMainPlayer || this.run.isFFA)
                playerTeam.runState.addInteraction(interaction);
        }
    }
    
    protected onEnemyDeath(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        this.onGeneralSecondaryInteraction(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    protected onPeriscope(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        this.onGeneralSecondaryInteraction(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    protected onSnowBumper(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        this.onGeneralSecondaryInteraction(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    protected onDarkCrystal(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        this.onGeneralSecondaryInteraction(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    protected onLpcChamber(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!this.localTeam) return;
        if (!isSelfInteraction && isTeammate)
            this.cleanupHandler.onLpcChamberStop(interaction);

        if (this.isLocalMainPlayer || this.run.isFFA)
            playerTeam.runState.addLpcInteraction(interaction);
    }

    protected onGeneralSecondaryInteraction(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!this.localTeam) return;
        if (!isSelfInteraction && isTeammate)
            this.cleanupHandler.onInteraction(interaction);

        if (this.isLocalMainPlayer || this.run.isFFA)
            playerTeam.runState.addInteraction(interaction);
    }

    onDestroy(): void {
        this.updateGameSettings(new GameSettings(RunData.getFreeroamSettings(pkg.version)));
        this.timerSubscription.unsubscribe();
        this.timer.reset();
        this.stopDrawPlayers();
        this.timer.onDestroy();
        this.launchListener();
        this.shutdownListener();
        this.ogSocket.complete();
    }
}
