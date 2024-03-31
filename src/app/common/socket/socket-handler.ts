
import { WebSocketSubject, webSocket } from "rxjs/webSocket";
import { Recording } from "./recording";
import { RecordingPositionData, UserPositionData } from "./position-data";
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
import { LevelHandler } from "../level/level-handler";
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

export class SocketHandler {

    recordings: Recording[] = [];
    private hasDrawnRecordingNames: boolean = false;
    private userPositionRecordings: Recording[] = [];

    timer: Timer;
    run: Run;
    localTeam: Team | undefined;

    protected isLocalMainPlayer: boolean = true;
    
    protected self: CurrentPlayerData;
    protected players: CurrentPlayerData[] = [];
    private drawPositions: boolean = false;
    private positionUpdateRateMs: number = 8;

    private socketCommandBuffer: OgCommand[] = []; 
    private socketPackage: SocketPackage = new SocketPackage();
    public socketConnected: boolean;
    ogSocket: WebSocketSubject<any> = webSocket('ws://localhost:8111');
    private launchListener: any;
    private shutdownListener: any;
    private connectionAttempts: number;


    constructor(public socketPort: number, public user: User, run: Run, public levelHandler: LevelHandler, public zone: NgZone) {
        this.ogSocket = webSocket('ws://localhost:' + socketPort);

        this.run = run;
        this.timer = run.timer;
        this.localTeam = run.getPlayerTeam(user.id);
        this.isLocalMainPlayer = socketPort === OG.mainPort;

        this.timer.linkSocketCommands(this.socketCommandBuffer);
        if (this.user.name) //if client is fully reloaded in a place where position service is started at same time as use we pick up user on movement instead
            this.checkRegisterPlayer(this.user, MultiplayerState.interactive);

        if (this.user.gameLaunched)
            this.connectToOpengoal();

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
                this.socketConnected = false;
                this.ogSocket.complete();
                this.ogSocket = webSocket('ws://localhost:' + socketPort);
            }

        });
    }

    private connectToOpengoal() {
        this.ogSocket.subscribe(target => {
            if (target.position)
                this.updatePlayerPosition(new UserPositionData(target.position, this.timer.totalMs, this.user));

            if (target.state) {
                if (target.state.justSpawned) {
                    if (!this.socketConnected) {

                        setTimeout(() => { //give the game a bit of time to actually start
                            console.log("Socket Connected!");
                            this.socketConnected = true;
                            this.updateGameSettings(new GameSettings(this.run.data));
                            this.run.getAllPlayers().forEach(player => { // set the team for any users already connected
                                this.updatePlayerInfo(player.user.id, this.run.getRemotePlayerInfo(player.user.id));
                            });
                            this.addCommand(OgCommand.None); //send empty message to update username, version & controller
                        }, 300);
                    }
                    
                    if (this.socketPort === OG.mainPort)
                        this.timer.onPlayerLoad();
                }

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
            }
      
            if (target.levels) {
              console.log(target.levels)
            }*/

            if (target.connected) {
                this.socketPackage.version = pkg.version;
                this.socketPackage.username = this.user.displayName;
            }
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

    resetGetRecordings(): Recording[] {
        const recordings = this.userPositionRecordings;
        this.cleanupPlayers();

        this.resetOngoingRecordings();
        this.recordings = [];
        this.players = [];
        return recordings;
    }

    resetOngoingRecordings() {
        this.userPositionRecordings = [];
    }

    updateLocalTeam(team: Team) {
        this.localTeam = team;
    }

    changeController(controllerPort: number) {
        this.socketPackage.controllerPort = controllerPort;
        this.user.controllerPort = controllerPort;
        this.addCommand(OgCommand.None);
    }

    addCommand(command: OgCommand) {
        this.socketCommandBuffer.push(command);
        while (this.socketCommandBuffer.length != 0 && !this.drawPositions && this.socketConnected)
            this.sendSocketPackageToOpengoal(false);
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
        
        player.positionData.username = "";
        player.positionData.mpState = MultiplayerState.disconnected;
        this.sendSocketPackageToOpengoal();

        this.players = this.players.filter(x => x.positionData.userId !== userId);

    }

    private checkRegisterPlayer(user: UserBase | undefined, state: MultiplayerState) {
        if (!user || this.players.find(x => x.positionData.userId === user.id)) return;

        if (user.id !== this.user.id) {
            this.players.push(new CurrentPlayerData(user, state));
            this.updatePlayerInfo(user.id, this.run.getRemotePlayerInfo(user.id));
        }
        else
            this.self = new CurrentPlayerData(user, MultiplayerState.interactive);
    }

    addRecording(recording: Recording, user: UserBase, state: MultiplayerState = MultiplayerState.active) {
        recording.userId = recording.id;
        user.id = recording.id;
        this.checkRegisterPlayer(user, state);
        this.recordings.push(recording);
    }

    setAllRealPlayersMultiplayerState() {
        this.players.forEach(player => {
            if (!this.recordings.some(x => x.id === player.positionData.userId))
                player.positionData.mpState = this.run.isMode(RunMode.Lockout) || this.localTeam?.players.some(x => x.user.id === player.positionData.userId) ? MultiplayerState.interactive : MultiplayerState.active;
        });
    }

    getSelfPosition(): CurrentPositionData | undefined {
        if (!this.self)
            this.checkRegisterPlayer(this.user.getUserBaseWithDisplayName(), MultiplayerState.interactive);

        return this.self.positionData;
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
            
            player.updateCurrentPosition(positionData, isLocalUser);


            if (isLocalUser) { //handled in draw update cycle for remote players
                const runPlayer = this.run.getPlayer(player.positionData.userId);
                if (this.run.timer.runState === RunState.Started && runPlayer && runPlayer.state !== PlayerState.Finished && runPlayer.state !== PlayerState.Forfeit)
                this.handlePlayerInteractions(player.positionData);
            }
        }
        else
            this.checkRegisterPlayer(new UserBase(positionData.userId, positionData.username), MultiplayerState.interactive);

        if (this.timer.totalMs === 0) return;
        //handle user position recording
        let userRecording = this.userPositionRecordings.find(x => x.userId === positionData.userId);

        //registner new if missing
        if (!userRecording) {
            userRecording = new Recording(positionData.userId);
            this.userPositionRecordings.push(userRecording);
        }

        userRecording.addPositionData(positionData);
    }

    startDrawPlayers() {
        if (this.drawPositions) return;
        this.drawPositions = true;
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

        if (this.timer.totalMs > 0) {
            this.recordings.forEach(recording => {
                const positionData = recording.getNextPositionData(this.timer.totalMs);
                if (positionData) {
                    const currentPlayer = this.players.find(x => x.positionData.userId === recording.userId);
                    if (currentPlayer) {

                        if (currentPlayer.positionData.currentLevel !== positionData.currentLevel)
                            this.addCommand(OgCommand.OnRemoteLevelUpdate);

                        const previousRecordingdataIndex = currentPlayer.recordingDataIndex;
                        const newRecordingdataIndex = recording.currentRecordingDataIndex;
                        if (currentPlayer.updateCurrentPosition(positionData, false, newRecordingdataIndex)) {

                            //handle missed pickups
                            if (previousRecordingdataIndex && (previousRecordingdataIndex - 1) > newRecordingdataIndex) {
                                console.log("skipped frames", previousRecordingdataIndex - newRecordingdataIndex - 1);
                                for (let i = previousRecordingdataIndex - 1; i >= newRecordingdataIndex; i--)
                                    this.addRecordingInteractionToBuffer(currentPlayer, recording.playback[i]);
                            }
                        }
                    }
                }
            });
        }

        if (this.timer.totalMs > 200) {
            if (!this.hasDrawnRecordingNames) {
                this.recordings.forEach(recording => {
                    const currentPlayer = this.players.find(x => x.positionData.userId === recording.userId);
                    if (currentPlayer) currentPlayer.positionData.username = recording.nameFrontend ?? "BLANK";
                });
            }
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
            if (this.self.hasInteractionUpdate()) this.self.positionData.resetCurrentInteraction();
            if (this.self.hasInfoUpdate()) this.self.positionData.resetCurrentInfo();

            this.self.checkUpdateInteractionFromBuffer();
            this.socketPackage.selfInteraction = this.self.positionData.interaction; //should only be for handling orb dupes and syncing interaction
        }
        this.players.forEach(player => {
            if (player.hasInteractionUpdate()) player.positionData.resetCurrentInteraction();
            if (player.hasInfoUpdate()) player.positionData.resetCurrentInfo();

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
        this.socketPackage.players = sendPlayers ? this.players.flatMap(x => x.positionData) : undefined;
        this.ogSocket.next(this.socketPackage);
        
        this.socketPackage.resetOneTimeValues();
    }

    private cleanupPlayers() {
        if (!this.players.some(x => x.positionData.mpState !== MultiplayerState.disconnected)) return;

        this.players.forEach(player => {
            player.positionData.username = "";
            player.positionData.mpState = MultiplayerState.disconnected;
        });

        this.sendSocketPackageToOpengoal();
    }
    

    private handlePlayerInteractions(positionData: CurrentPositionData) {
        if (!positionData.interaction || positionData.interaction.interType === InteractionType.none || positionData.interaction.interCleanup) return;
        const userId = this.user.id;
        const interaction = UserInteractionData.fromInteractionData(positionData.interaction, positionData.userId);
        const isSelfInteraction: boolean = positionData.userId === userId;
        const playerTeam: Team | undefined = this.run.getPlayerTeam(positionData.userId);
        if (!this.localTeam || !playerTeam) return;
        const isTeammate = isSelfInteraction || (playerTeam.id === this.localTeam.id && !RunMod.singleTeamEqualsFFA(this.run.data.mode));
        //interactions on game side is executed if the target the interaction belongs to is set to interactive, to avoid use positionData.resetCurrentInteraction();

        switch (positionData.interaction.interType) {

            case InteractionType.gameTask:
                this.onTask(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;
        
            case InteractionType.buzzer:
                this.onBuzzer(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.money:
                this.onOrb(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.ecoBlue:
            case InteractionType.ecoYellow:
            case InteractionType.ecoGreen:
            case InteractionType.ecoRed:
                this.onEco(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.fish:
                this.onFish(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.bossPhase:
                this.onBossPhase(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.crate:
                this.onCrate(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.enemyDeath:
                this.onEnemyDeath(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.periscope:
                this.onPeriscope(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.snowBumper:
                this.onSnowBumper(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.darkCrystal:
                this.onDarkCrystal(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

            case InteractionType.lpcChamber:
                this.onLpcChamber(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                break;

        }
    }

    
    protected onTask(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

        const task: GameTaskLevelTime = GameTaskLevelTime.fromCurrentPositionData(positionData, interaction);
        
        //check duped cell buy
        if (isSelfInteraction && Task.isCellWithCost(task.name) && this.localTeam && this.localTeam.runState.hasAtleastTaskStatus(interaction.interName, TaskStatus.needResolution)) {
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

        if (isCell && isNewTaskStatus && this.isLocalMainPlayer) { // end run split added in EndPlayerRun event
            this.zone.run(() => {
                this.run.addSplit(new Task(task));
            });
        }
        this.updatePlayerInfo(positionData.userId, this.run.getRemotePlayerInfo(positionData.userId));

        if (!playerTeam) return;

        //handle none current user things
        if (!isSelfInteraction && isTeammate) {

            //task updates
            if (isNewTaskStatus)
                this.levelHandler.onInteraction(interaction);

            //cell cost check
            if (isCell && isTeammate && !interaction.interCleanup && Task.cellCost(interaction) !== 0)
                this.addOrbAdjustmentToCurrentPlayer(-(Task.cellCost(interaction)), interaction.interLevel);
        }

        if (!isNewTaskStatus) return;
        
        //add to team run state
        if (this.isLocalMainPlayer)
            playerTeam.runState.addTaskInteraction(interaction);
    }
    
    protected onBuzzer(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isSelfInteraction && isTeammate)
        this.levelHandler.onInteraction(interaction);

        if (this.isLocalMainPlayer)
            playerTeam.runState.addBuzzerInteraction(interaction);
    }
    
    protected onOrb(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

        if (playerTeam.runState.isFalseOrb(interaction)) {
            positionData.resetCurrentInteraction();
            return;
        }
        
        if (playerTeam.runState.checkDupeAddOrbInteraction(playerTeam.players, userId, this.isLocalMainPlayer, interaction)) {
            if (isSelfInteraction)
                this.addOrbAdjustmentToCurrentPlayer(-1, interaction.interLevel);
            else if (!interaction.interCleanup)
                positionData.resetCurrentInteraction();
                return;
        }
        
        if (!isSelfInteraction && isTeammate)
            this.levelHandler.onInteraction(interaction);
    }

    protected onEco(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

    }
    
    protected onFish(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

    }
    
    protected onBossPhase(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

    }
    
    protected onCrate(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!this.localTeam) return;
        if ((InteractionData.isBuzzerCrate(interaction) || InteractionData.isOrbsCrate(interaction))) {
            if (!isSelfInteraction && isTeammate)
                this.levelHandler.onInteraction(interaction);
    
            if (this.isLocalMainPlayer)
            playerTeam.runState.addInteraction(interaction);
        }
    }
    
    protected onEnemyDeath(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        this.onGeneralSecondaryInteraction(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    protected onPeriscope(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        this.onGeneralSecondaryInteraction(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    protected onSnowBumper(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        this.onGeneralSecondaryInteraction(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    protected onDarkCrystal(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        this.onGeneralSecondaryInteraction(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    protected onLpcChamber(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!this.localTeam) return;
        if (!isSelfInteraction && isTeammate)
            this.levelHandler.onLpcChamberStop(interaction);

        if (this.isLocalMainPlayer)
            playerTeam.runState.addLpcInteraction(interaction);
    }

    protected onGeneralSecondaryInteraction(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!this.localTeam) return;
        if (!isSelfInteraction && isTeammate)
            this.levelHandler.onInteraction(interaction);

        if (this.isLocalMainPlayer)
            playerTeam.runState.addInteraction(interaction);
    }

    onDestroy(): void {
        this.updateGameSettings(new GameSettings(undefined));
        this.timer.reset();
        this.stopDrawPlayers();
        this.timer.onDestroy();
        this.launchListener();
        this.shutdownListener();
        this.ogSocket.complete();
    }
}
