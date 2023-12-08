
import { WebSocketSubject, webSocket } from "rxjs/webSocket";
import { Recording } from "./recording";
import { PositionData, UserPositionData } from "./position-data";
import { UserService } from "src/app/services/user.service";
import { UserBase } from "../user/user";
import { MultiplayerState } from "../opengoal/multiplayer-state";
import { InteractionType } from "../opengoal/interaction-type";
import { Timer } from "../run/timer";
import { InteractionData, UserInteractionData } from "./interaction-data";
import { CurrentPlayerData, CurrentPositionData } from "./current-position-data";
import { LocalPlayerData } from "../user/local-player-data";
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

export class PlayerHandler {

    recordings: Recording[] = [];
    private hasDrawnRecordingNames: boolean = false;
    private userPositionRecording: Recording[] = [];

    timer: Timer = new Timer();
    run: Run | undefined;

    private self: CurrentPlayerData;
    private players: CurrentPlayerData[] = [];
    private drawPositions: boolean = false;
    private positionUpdateRateMs: number = 16;

    private socketCommandBuffer: OgCommand[] = []; 
    private socketPackage: SocketPackage = new SocketPackage();
    ogSocket: WebSocketSubject<any> = webSocket('ws://localhost:8111');
    private launchListener: any;
    private connectionAttempts: number;


    constructor(public userService: UserService, public levelHandler: LevelHandler, public localPlayer: LocalPlayerData, public zone: NgZone) {

        this.timer.linkSocketCommands(this.socketCommandBuffer);
        if (this.userService.user.name) //if client is fully reloaded in a place where position service is started at same time as use we pick up user on movement instead
            this.checkRegisterPlayer(this.userService.user, MultiplayerState.interactive);

        if (this.userService.gameLaunched)
            this.connectToOpengoal();

        this.launchListener = (window as any).electron.receive("og-launched", (launched: boolean) => {
            if (launched) {
                this.connectionAttempts = 0;
                this.connectToOpengoal();
            }
            else {
                this.ogSocket.complete();
                this.ogSocket = webSocket('ws://localhost:8111');
            }

        });
    }

    private connectToOpengoal() {
        this.ogSocket.subscribe(target => {
            if (target.position)
                this.updatePlayerPosition(new UserPositionData(target.position, this.timer.totalMs, this.userService.user));

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
                this.userService.socketConnected = true;
                this.socketPackage.username = this.userService.user.displayName;
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
        const recordings = this.userPositionRecording;
        this.cleanupPlayers();

        this.resetOngoingRecordings();
        this.recordings = [];
        this.players = [];
        return recordings;
    }

    resetOngoingRecordings() {
        this.userPositionRecording = [];
    }

    getCurrentPlayer(): CurrentPlayerData | undefined {
        return this.players.find(x => x.positionData.userId === this.userService.getId());
    }

    addCommand(command: OgCommand) {
        this.socketCommandBuffer.push(command);
        if (!this.drawPositions && this.userService.socketConnected)
            this.sendSocketPackageToOpengoal(false);
    }

    private addInteractionToBuffer(currentPlayer: CurrentPlayerData, positionData: PositionData) {
        if (currentPlayer.positionData.mpState === MultiplayerState.interactive && positionData.interType && positionData.interType !== InteractionType.none)
            currentPlayer.interactionBuffer.push(InteractionData.getInteractionValues(positionData));
    }

    addPlayerInteraction(interaction: UserInteractionData) {
        const player = this.players.find(x => x.positionData.userId == interaction.userId);
        if (!player || interaction.interType === InteractionType.none) return;
        player.interactionBuffer.push(InteractionData.getInteractionValues(interaction));
    }

    updatePlayerInfo(userId: string, playerInfo: RemotePlayerInfo | undefined) {
        if (!playerInfo) return;

        if (!this.self)
            this.checkRegisterPlayer(this.userService.user.getUserBase(), MultiplayerState.interactive);

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
            userId: this.userService.getId()
        };
        this.addPlayerInteraction(orbReductionInteraction);
    }

    removePlayer(userId: string) {
        this.recordings = this.recordings.filter(x => x.userId !== userId);
        this.userPositionRecording = this.userPositionRecording.filter(x => x.userId !== userId);
        this.players = this.players.filter(x => x.positionData.userId !== userId);
    }

    checkRegisterPlayer(user: UserBase | undefined, state: MultiplayerState) {
        if (!user || this.players.find(x => x.positionData.userId === user.id)) return;

        if (user.id !== this.userService.getId())
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


    updatePlayerPosition(positionData: UserPositionData) {
        const isLocalUser = positionData.userId === this.userService.user.id;
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
        let userRecording = this.userPositionRecording.find(x => x.userId === positionData.userId);

        //registner new if missing
        if (!userRecording) {
            userRecording = new Recording(positionData.userId);
            this.userPositionRecording.push(userRecording);
        }

        userRecording.playback.unshift(positionData);
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
                const positionData = recording.playback.find(x => x.time < this.timer.totalMs);
                if (positionData) {
                    const currentPlayer = this.players.find(x => x.positionData.userId === recording.userId);
                    if (currentPlayer) {

                        if (currentPlayer.positionData.currentLevel !== positionData.currentLevel)
                            this.addCommand(OgCommand.OnRemoteLevelUpdate);

                        const previousRecordingdataIndex = currentPlayer.recordingDataIndex;
                        const newRecordingdataIndex = recording.playback.indexOf(positionData);
                        if (currentPlayer.updateCurrentPosition(positionData, false, newRecordingdataIndex)) {

                            //handle missed pickups
                            if (previousRecordingdataIndex && (previousRecordingdataIndex - 1) > newRecordingdataIndex) {
                                console.log("skipped frames", previousRecordingdataIndex - newRecordingdataIndex - 1);
                                for (let i = previousRecordingdataIndex - 1; i > newRecordingdataIndex; i--)
                                    this.addInteractionToBuffer(currentPlayer, recording.playback[i]);
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

    userIsNull() {
        return !this.localPlayer.user.id || this.localPlayer.user.id === "";
    }
    

    handlePlayerInteractions(positionData: CurrentPositionData) {
        if (!positionData.interaction || positionData.interaction.interType === InteractionType.none || !this.run) return;
        const userId = this.userService.getId();
        const interaction = UserInteractionData.fromInteractionData(positionData.interaction, positionData.userId);

        switch (positionData.interaction.interType) {

            case InteractionType.gameTask:
                if (!this.localPlayer.team || this.userIsNull()) break;
                
                const task: GameTaskLevelTime = GameTaskLevelTime.fromCurrentPositionData(positionData, positionData.interaction);
                const isNewTaskStatus: boolean = this.localPlayer.team.runState.isNewTaskStatus(interaction);
                if (positionData.userId === userId)
                {
                    //check duped cell buy
                    if (Task.isCellWithCost(task.name) && this.localPlayer.team && this.localPlayer.team.runState.hasAtleastTaskStatus(interaction.interName, TaskStatus.needResolution))
                        this.addOrbReductionToCurrentPlayer(Task.cellCost(interaction), interaction.interLevel);

                    if (task.name === "citadel-sage-green")
                        this.localPlayer.hasCitadelSkipAccess = false;

                    if (isNewTaskStatus && Task.isRunEnd(task)) {
                        this.zone.run(() => {
                            this.localPlayer.state = PlayerState.Finished;
                            //this.sendEvent(EventType.EndPlayerRun, task);
                        });
                    }
                }

                if (!isNewTaskStatus) break;
                const isCell: boolean = Task.isCellCollect(interaction.interName, TaskStatus.nameFromEnum(interaction.interStatus));
                if (isCell || Task.isRunEnd(task)) {
                    this.zone.run(() => {
                        this.run!.addSplit(new Task(task));
                    });
                this.updatePlayerInfo(positionData.userId, this.run.getRemotePlayerInfo(positionData.userId));
                }

                const playerTeam = this.run.getPlayerTeam(positionData.userId);
                if (!playerTeam) break;
                const isLocalPlayerTeam = playerTeam.id === this.localPlayer.team.id;
                

                //handle none current user things
                if (positionData.userId !== userId && (this.run.isMode(RunMode.Lockout) || isLocalPlayerTeam)) {

                    //task updates
                    this.levelHandler.onInteraction(interaction);

                    //cell cost check
                    if (isCell && isLocalPlayerTeam && !this.run.isMode(RunMode.Lockout)) {
                        const cost = Task.cellCost(interaction);
                        if (cost !== 0)
                            this.addOrbReductionToCurrentPlayer(Task.cellCost(interaction), interaction.interLevel);
                    }
                }
                
                //add to team run state
                playerTeam.runState.addTaskInteraction(interaction);
                
                break;
        
            case InteractionType.buzzer:
                if (!this.localPlayer.team) break;
                
                if (positionData.userId !== userId && this.run.getPlayerTeam(positionData.userId)?.id === this.localPlayer.team.id)
                    this.levelHandler.onInteraction(interaction);

                this.run.getPlayerTeam(positionData.userId)?.runState.addBuzzerInteraction(interaction);
                break;
            

            case InteractionType.money:
                if (!this.localPlayer.team) break;
                
                let teamOrbLevelState = this.localPlayer.team.runState.getCreateLevel(interaction.interLevel);
                if (this.localPlayer.team.runState.isOrbDupe(interaction, teamOrbLevelState)) {
                    if (positionData.userId === userId)
                        this.addOrbReductionToCurrentPlayer(-1, interaction.interLevel);
                    else if (!interaction.interCleanup)
                        positionData.resetCurrentInteraction();
                    break;
                }
                if (positionData.userId !== userId && (this.run.isMode(RunMode.Lockout) || this.run.getPlayerTeam(positionData.userId)?.id === this.localPlayer.team.id))
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
                if (!this.localPlayer.team) break;
                if (positionData.userId !== userId && ((this.run.isMode(RunMode.Lockout) && !InteractionData.isBuzzerCrate(interaction.interType)) || this.run.getPlayerTeam(positionData.userId)?.id === this.localPlayer.team.id))
                    this.levelHandler.onInteraction(interaction);

                if (InteractionData.isBuzzerCrate(interaction.interType) || InteractionData.isOrbsCrate(interaction.interType))
                    this.run.getPlayerTeam(positionData.userId)?.runState.addInteraction(interaction);
                break;


            case InteractionType.enemyDeath:
            case InteractionType.periscope:
            case InteractionType.snowBumper:
            case InteractionType.darkCrystal:
                if (!this.localPlayer.team) break;
                if (positionData.userId !== userId && (this.run.isMode(RunMode.Lockout) || this.run.getPlayerTeam(positionData.userId)?.id === this.localPlayer.team.id))
                    this.levelHandler.onInteraction(interaction);

                this.run.getPlayerTeam(positionData.userId)?.runState.addInteraction(interaction);
                break;


            case InteractionType.lpcChamber:
                if (!this.localPlayer.team) break;
                if (positionData.userId !== userId && (this.run.isMode(RunMode.Lockout) || this.run.getPlayerTeam(positionData.userId)?.id === this.localPlayer.team.id))
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
        this.ogSocket.complete();
    }
}
