
import { WebSocketSubject, webSocket } from "rxjs/webSocket";
import { Subject } from 'rxjs';
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

export class PositionHandler {

    recordings: Recording[] = [];
    private hasDrawnRecordingNames: boolean = false;
    private userPositionRecording: Recording[] = [];

    timer: Timer = new Timer();
    run: Run | undefined;

    private self: CurrentPlayerData;
    private players: CurrentPlayerData[] = [];
    private drawPositions: boolean = false;
    private positionUpdateRateMs: number = 16;

    ogSocket: WebSocketSubject<any> = webSocket('ws://localhost:8111');
    private launchListener: any;


    constructor(public userService: UserService, public levelHandler: LevelHandler, public localPlayer: LocalPlayerData, public zone: NgZone) {

        if (this.userService.user.name) //if client is fully reloaded in a place where position service is started at same time as use we pick up user on movement instead
            this.checkRegisterPlayer(this.userService.user, MultiplayerState.interactive);

        if (this.userService.gameLaunched)
            this.connectToOpengoal();

        this.launchListener = (window as any).electron.receive("og-launched", (launched: boolean) => {
            if (launched)
                this.connectToOpengoal();
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
                this.userService.replConnected = true;
                console.log("REPL Connected!");
            }
        },
            error => {
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

    getPlayerIngameIndex(id: string): number | undefined {
        const player = this.players.find(x => x.positionData.userId === id);
        return player ? (this.players.indexOf(player) + 1) : undefined; //current is always 0 inside opengoal so + 1 for remote id
    }

    getCurrentPlayer(): CurrentPlayerData | undefined {
        return this.players.find(x => x.positionData.userId === this.userService.getId());
    }

    addPlayerInteraction(interaction: UserInteractionData) {
        const player = this.players.find(x => x.positionData.userId == interaction.userId);
        if (!player) return;
        player.interactionBuffer.push(InteractionData.getInteractionValues(interaction));
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
            player.updateCurrentPosition(positionData, isLocalUser);
            if (isLocalUser) {
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

        this.players.forEach(player => {
            //ensure interaction don't run twice
            if (!player.hasFrameUpdate)
                player.positionData.resetCurrentInteraction();

            player.hasFrameUpdate = false; 

            //fill interaction from buffer if possible
            player.checkUpdateInteractionFromBuffer();
    
            //handle interaction data for run and player
            const runPlayer = this.run?.getPlayer(player.positionData.userId);
            if (this.run?.timer.runState === RunState.Started && runPlayer && runPlayer.state !== PlayerState.Finished && runPlayer.state !== PlayerState.Forfeit)
                this.handlePlayerInteractions(player.positionData);
        });

        this.updatePlayersInOpengoal();
        await new Promise(r => setTimeout(r, this.positionUpdateRateMs));

        this.drawPlayers();
    }

    private addInteractionToBuffer(currentPlayer: CurrentPlayerData, positionData: PositionData) {
        if (currentPlayer.positionData.mpState === MultiplayerState.interactive && positionData.interType && positionData.interType !== InteractionType.none)
            currentPlayer.interactionBuffer.push(InteractionData.getInteractionValues(positionData));
    }

    private updatePlayersInOpengoal() {
        this.ogSocket.next(this.players.flatMap(x => x.positionData));
    }

    private cleanupPlayers() {
        if (!this.players.some(x => x.positionData.mpState !== MultiplayerState.disconnected)) return;

        this.players.forEach(player => {
            player.positionData.username = "";
            player.positionData.mpState = MultiplayerState.disconnected;
        });

        this.updatePlayersInOpengoal();
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
                const isNewTask: boolean = this.localPlayer.team.runState.isNewTaskStatus(interaction);
                if (positionData.userId === userId)
                {
                    //check duped cell buy
                    if (Task.isCellWithCost(task.name) && this.localPlayer.team && this.localPlayer.team.runState.hasAtleastTaskStatus(interaction.interName, TaskStatus.needResolution))
                        this.addOrbReductionToCurrentPlayer(Task.cellCost(interaction), interaction.interLevel);

                    if (task.name === "citadel-sage-green")
                        this.localPlayer.hasCitadelSkipAccess = false;

                    if (isNewTask && Task.isRunEnd(task)) {
                        this.zone.run(() => {
                            this.localPlayer.state = PlayerState.Finished;
                            //this.sendEvent(EventType.EndPlayerRun, task);
                        });
                    }
                }

                if (!isNewTask) break;
                
                const isCell: boolean = Task.isCellCollect(interaction.interName, TaskStatus.nameFromEnum(interaction.interAmount));
                if (isCell || Task.isRunEnd(task)) {
                    this.zone.run(() => {
                        this.run!.addSplit(new Task(task));
                    });
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

                    this.localPlayer.checkTaskUpdateSpecialCases(task, this.run);
                }
                
                //add to team run state
                playerTeam.runState.addTaskInteraction(interaction);

                //handle Lockout
                if (this.run.isMode(RunMode.Lockout))
                    this.localPlayer.checkLockoutRestrictions(this.run);
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
                    else
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
        this.timer.reset();
        this.stopDrawPlayers();
        this.timer.onDestroy();
        this.launchListener();
        this.ogSocket.complete();
    }
}
