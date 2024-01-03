
import { WebSocketSubject, webSocket } from "rxjs/webSocket";
import { Recording } from "./recording";
import { RecordingPositionData, UserPositionData } from "./position-data";
import { User, UserBase } from "../user/user";
import { MultiplayerState } from "../opengoal/multiplayer-state";
import { InteractionType } from "../opengoal/interaction-type";
import { Timer } from "../run/timer";
import { InteractionData, UserInteractionData } from "./interaction-data";
import { CurrentPlayerData, CurrentPositionData } from "./current-position-data";
import { GameTaskLevelTime } from "../opengoal/game-task";
import { Task } from "../opengoal/task";
import { PlayerState } from "../player/player-state";
import { TaskStatus } from "../opengoal/task-status";
import { RunMode } from "../run/run-mode";
import { Run } from "../run/run";
import { LevelHandler } from "../level/level-handler";
import { RunState } from "../run/run-state";
import { NgZone } from "@angular/core";
import { RemotePlayerInfo } from "./remote-player-info";
import { SocketPackage } from "./socket-package";
import { OgCommand } from "./og-command";
import { GameSettings } from "./game-settings";
import { Team } from "../run/team";

export class SocketHandler {

    recordings: Recording[] = [];
    private hasDrawnRecordingNames: boolean = false;
    private userPositionRecordings: Recording[] = [];

    timer: Timer = new Timer();
    run: Run | undefined;

    private self: CurrentPlayerData;
    private players: CurrentPlayerData[] = [];
    private drawPositions: boolean = false;
    private positionUpdateRateMs: number = 8;

    private socketCommandBuffer: OgCommand[] = []; 
    private socketPackage: SocketPackage = new SocketPackage();
    public socketConnected: boolean;
    ogSocket: WebSocketSubject<any> = webSocket('ws://localhost:8111');
    private launchListener: any;
    private shutdownListener: any;
    private connectionAttempts: number;


    constructor(public socketPort: number, public user: User, public levelHandler: LevelHandler, public localTeam: Team | undefined, public zone: NgZone, private importedTimer: Timer | undefined = undefined) {
        this.ogSocket = webSocket('ws://localhost:' + socketPort);
        if (importedTimer)
            this.timer = importedTimer;
        this.timer.linkSocketCommands(this.socketCommandBuffer);
        if (this.user.name) //if client is fully reloaded in a place where position service is started at same time as use we pick up user on movement instead
            this.checkRegisterPlayer(this.user, MultiplayerState.interactive);

        if (this.user.gameLaunched)
            this.connectToOpengoal();

        this.launchListener = (window as any).electron.receive("og-launched", (port: number) => {
            if (port == this.socketPort) {
                this.socketConnected = true;
                this.connectionAttempts = 0;
                this.user.gameLaunched = true;
                this.connectToOpengoal();
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

            if (target.state && target.state.justSpawned)
                this.timer.onPlayerLoad();

            /*
            if (target.state) {
              console.log(target.state)
            }
      
            if (target.levels) {
              console.log(target.levels)
            }*/

            if (target.connected) {
                this.socketConnected = true;
                this.socketPackage.username = this.user.displayName;
                console.log("Socket Connected!");
                this.addCommand(OgCommand.None); //send empty message to update username
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
        if (this.socketConnected)
            this.sendSocketPackageToOpengoal(false);
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
        const player = this.players.find(x => x.positionData.userId == interaction.userId);
        if (!player || interaction.interType === InteractionType.none) return;
        player.interactionBuffer.push(InteractionData.getInteractionValues(interaction));
    }

    updatePlayerInfo(userId: string, playerInfo: RemotePlayerInfo | undefined) {
        if (!playerInfo) return;

        if (!this.self)
            this.checkRegisterPlayer(this.user.getUserBase(), MultiplayerState.interactive);

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

    addOrbReductionToCurrentPlayer(reductionAmount: number, level: string) {
        const orbReductionInteraction: UserInteractionData = {
            interType: InteractionType.money,
            interAmount: reductionAmount < 0 ? reductionAmount : -reductionAmount,
            interStatus: 0,
            interName: "money",
            interParent: "entity-pool",
            interLevel: level,
            interCleanup: false,
            time: 0,
            userId: this.user.id
        };
        this.addPlayerInteraction(orbReductionInteraction);
    }

    removePlayer(userId: string) {
        this.recordings = this.recordings.filter(x => x.userId !== userId);
        this.userPositionRecordings = this.userPositionRecordings.filter(x => x.userId !== userId);
        this.players = this.players.filter(x => x.positionData.userId !== userId);
    }

    checkRegisterPlayer(user: UserBase | undefined, state: MultiplayerState) {
        if (!user || this.players.find(x => x.positionData.userId === user.id)) return;

        if (user.id !== this.user.id)
            this.players.push(new CurrentPlayerData(user, state));
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
                player.positionData.mpState = this.localTeam?.players.some(x => x.user.id === player.positionData.userId) ? MultiplayerState.interactive : MultiplayerState.active;
        });
    }


    updatePlayerPosition(positionData: UserPositionData) {
        const isLocalUser = positionData.userId === this.user.id;
        let player = !isLocalUser ? this.players.find(x => x.positionData.userId === positionData.userId) : this.self;
        if (player) {
            if (player.positionData.currentLevel !== positionData.currentLevel) {
                this.addCommand(OgCommand.OnRemoteLevelUpdate);
                const runPlayer = this.run?.getPlayer(player.positionData.userId);
                if (runPlayer) runPlayer.currentLevel = positionData.currentLevel;
            }
            
            player.updateCurrentPosition(positionData, isLocalUser);


            if (isLocalUser) { //handled in draw update cycle for remote players
                const runPlayer = this.run?.getPlayer(player.positionData.userId);
                if (this.run?.timer.runState === RunState.Started && runPlayer && runPlayer.state !== PlayerState.Finished && runPlayer.state !== PlayerState.Forfeit)
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
            const runPlayer = this.run?.getPlayer(player.positionData.userId);
            if (this.run?.timer.runState === RunState.Started && runPlayer && runPlayer.state !== PlayerState.Finished && runPlayer.state !== PlayerState.Forfeit)
                this.handlePlayerInteractions(player.positionData);
        });

        //send data
        this.sendSocketPackageToOpengoal();

        //post cleanup and buffer check
        if (this.self) {
            if (this.self.hasInteractionUpdate()) this.self.positionData.resetCurrentInteraction();
            if (this.self.hasInfoUpdate()) this.self.positionData.resetCurrentInfo();
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
        if (this.socketCommandBuffer.length !== 0)
            this.socketPackage.command = this.socketCommandBuffer.shift();
        this.socketPackage.players = sendPlayers ? this.players.flatMap(x => x.positionData) : undefined;
        this.ogSocket.next(this.socketPackage);

        this.socketPackage.controllerPort = undefined;
        this.socketPackage.command = undefined;
        this.socketPackage.selfInfo = undefined;
        this.socketPackage.gameSettings = undefined;
    }

    private cleanupPlayers() {
        if (!this.players.some(x => x.positionData.mpState !== MultiplayerState.disconnected)) return;

        this.players.forEach(player => {
            player.positionData.username = "";
            player.positionData.mpState = MultiplayerState.disconnected;
        });

        this.sendSocketPackageToOpengoal();
    }
    

    handlePlayerInteractions(positionData: CurrentPositionData) {
        if (!positionData.interaction || positionData.interaction.interType === InteractionType.none || !this.run) return;
        const userId = this.user.id;
        const interaction = UserInteractionData.fromInteractionData(positionData.interaction, positionData.userId);
        const isSelfInteraction: boolean = positionData.userId === userId;

        switch (positionData.interaction.interType) {

            case InteractionType.gameTask:
                if (!this.localTeam) break;
                
                const task: GameTaskLevelTime = GameTaskLevelTime.fromCurrentPositionData(positionData, positionData.interaction);
                const isNewTaskStatus: boolean = this.localTeam.runState.isNewTaskStatus(interaction);
                
                //check duped cell buy
                if (positionData.userId === userId && Task.isCellWithCost(task.name) && this.localTeam && this.localTeam.runState.hasAtleastTaskStatus(interaction.interName, TaskStatus.needResolution))
                    this.addOrbReductionToCurrentPlayer(Task.cellCost(interaction), interaction.interLevel);

                //set players to act as ghosts on run end
                if (isNewTaskStatus && Task.isRunEnd(interaction)) {
                    const player = this.players.find(x => x.positionData.userId === positionData.userId);
                    if (player) player.positionData.mpState = MultiplayerState.active;
                }
                const isCell: boolean = Task.isCellCollect(interaction.interName, TaskStatus.nameFromEnum(interaction.interStatus));
                if (isCell && isNewTaskStatus) { // end run split added in EndPlayerRun event
                    this.zone.run(() => {
                        this.run!.addSplit(new Task(task));
                    });
                }
                this.updatePlayerInfo(positionData.userId, this.run.getRemotePlayerInfo(positionData.userId));
                if (!isNewTaskStatus) break;


                const playerTeam = this.run.getPlayerTeam(positionData.userId);
                if (!playerTeam) break;
                const isLocalPlayerTeam = playerTeam.id === this.localTeam.id;
                

                //handle none current user things
                if (!isSelfInteraction && (this.run.isMode(RunMode.Lockout) || isLocalPlayerTeam)) {

                    //task updates
                    this.levelHandler.onInteraction(interaction);

                    //cell cost check
                    if (isCell && isLocalPlayerTeam && (!this.run.isMode(RunMode.Lockout) || this.run.teams.length !== 1) && Task.cellCost(interaction) !== 0)
                        this.addOrbReductionToCurrentPlayer(Task.cellCost(interaction), interaction.interLevel);
                }
                
                //add to team run state
                playerTeam.runState.addTaskInteraction(interaction);
                
                break;
        
            case InteractionType.buzzer:
                if (!this.localTeam) break;
                
                if (!isSelfInteraction && this.run.getPlayerTeam(positionData.userId)?.id === this.localTeam.id)
                    this.levelHandler.onInteraction(interaction);

                this.run.getPlayerTeam(positionData.userId)?.runState.addBuzzerInteraction(interaction);
                break;
            

            case InteractionType.money:
                if (!this.localTeam) break;
                
                let teamOrbLevelState = this.localTeam.runState.getCreateLevel(interaction.interLevel);
                if (this.localTeam.runState.isOrbDupe(interaction, teamOrbLevelState)) {
                    if (isSelfInteraction)
                        this.addOrbReductionToCurrentPlayer(-1, interaction.interLevel);
                    else if (!interaction.interCleanup)
                        positionData.resetCurrentInteraction();
                    break;
                }
                if (!isSelfInteraction && (this.run.isMode(RunMode.Lockout) || this.run.getPlayerTeam(positionData.userId)?.id === this.localTeam.id))
                    this.levelHandler.onInteraction(interaction);
                
                this.run.getPlayerTeam(positionData.userId)?.runState.addOrbInteraction(interaction, teamOrbLevelState);
                break;
        

            case InteractionType.ecoBlue:
            case InteractionType.ecoYellow:
            case InteractionType.ecoGreen:
            case InteractionType.ecoRed:
                break;

            case InteractionType.fishCaught:
            case InteractionType.fishMissed:
                break;

            case InteractionType.bossPhase:
                break;


            case InteractionType.crateNormal:
            case InteractionType.crateIron:
            case InteractionType.crateSteel:
            case InteractionType.crateDarkeco:
                if (!this.localTeam) break;
                if (positionData.userId !== userId && ((this.run.isMode(RunMode.Lockout) && !InteractionData.isBuzzerCrate(interaction.interType)) || this.run.getPlayerTeam(positionData.userId)?.id === this.localTeam.id))
                    this.levelHandler.onInteraction(interaction);

                if (InteractionData.isBuzzerCrate(interaction.interType) || InteractionData.isOrbsCrate(interaction.interType))
                    this.run.getPlayerTeam(positionData.userId)?.runState.addInteraction(interaction);
                break;


            case InteractionType.enemyDeath:
            case InteractionType.periscope:
            case InteractionType.snowBumper:
            case InteractionType.darkCrystal:
                if (!this.localTeam) break;
                if (positionData.userId !== userId && (this.run.isMode(RunMode.Lockout) || this.run.getPlayerTeam(positionData.userId)?.id === this.localTeam.id))
                    this.levelHandler.onInteraction(interaction);

                this.run.getPlayerTeam(positionData.userId)?.runState.addInteraction(interaction);
                break;


            case InteractionType.lpcChamber:
                if (!this.localTeam) break;
                if (positionData.userId !== userId && (this.run.isMode(RunMode.Lockout) || this.run.getPlayerTeam(positionData.userId)?.id === this.localTeam.id))
                    this.levelHandler.onLpcChamberStop(interaction);

                this.run.getPlayerTeam(positionData.userId)?.runState.addLpcInteraction(interaction);
                break;

        }
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
