import { Run } from "./run";
import { RunMod, RunMode } from "./run-mode";
import { LocalPlayerData } from "../user/local-player-data";
import { Lobby } from "../firestore/lobby";
import { RTCPeerMaster } from "../peer/rtc-peer-master";
import { RTCPeerSlave } from "../peer/rtc-peer-slave";
import { UserService } from "src/app/services/user.service";
import { BehaviorSubject, Subscription, finalize } from "rxjs";
import { DataChannelEvent } from "../peer/data-channel-event";
import { EventType } from "../peer/event-type";
import { PlayerState } from "../player/player-state";
import { NgZone } from "@angular/core";
import { Task } from "../opengoal/task";
import { LobbyUser } from "../firestore/lobby-user";
import { UserBase } from "../user/user";
import { FireStoreService } from "src/app/services/fire-store.service";
import { CitadelOption, RunData } from "./run-data";
import { Player } from "../player/player";
import { Category, CategoryOption } from "./category";
import { DbRun } from "../firestore/db-run";
import { UserPositionData } from "../socket/position-data";
import { GameState } from "../opengoal/game-state";
import pkg from 'app/package.json';
import { OgCommand } from "../socket/og-command";
import { GameSettings } from "../socket/game-settings";
import { SyncRequest, SyncRequestReason } from "./sync-request";
import { SyncResponse } from "./sync-response";
import { OG } from "../opengoal/og";
import { RecordingFile } from "../recording/recording-file";
import { UserRecording } from "../recording/user-recording";
import { PbCommentDialogComponent } from "src/app/dialogs/pb-comment-dialog/pb-comment-dialog.component";
import { DbRunUserContent } from "../firestore/db-run-user-content";
import { MatDialog } from "@angular/material/dialog";
import { DbPb } from "../firestore/db-pb";
import { GameTaskLevelTime } from "../opengoal/game-task";
import { RecordingPackage } from "../recording/recording-package";
import { Recording } from "../recording/recording";
import { MultiplayerState } from "../opengoal/multiplayer-state";
import { Team } from "./team";
import { SyncType } from "../level/sync-type";
import { RunState } from "./run-state";
import { PbTeamPlayers } from "../peer/pb-team-players";

export class RunHandler {

    lobby: Lobby | undefined;
    run: Run | undefined;
    selfImportedRecordings: UserBase[] = [];

    connected: boolean = false;
    info: string = "";
    isBeingDestroyed: boolean = false;
    becomeHostQuickAccess: boolean;

    isOnlineInstant: boolean = false;
    localMaster: RTCPeerMaster | undefined;
    localSlave: RTCPeerSlave | undefined;

    dataSubscription: Subscription;
    positionSubscription: Subscription;
    lobbySubscription: Subscription;
    userSetupSubscription: Subscription;
    pbSubscription: Subscription;
    private launchListener: any;

    runSetupCompleteSubject: BehaviorSubject<RunData | null> = new BehaviorSubject<RunData | null>(null);

    constructor(lobbyId: string | undefined,
        public firestoreService: FireStoreService,
        public userService: UserService,
        public dialog: MatDialog,
        public zone: NgZone,
        public isPracticeTool: boolean = false) {
        
        this.isOnlineInstant = lobbyId !== undefined;
        this.zone = zone;
        
        this.userSetupSubscription = this.userService.userSetupSubject.subscribe(user => {
            if (!user) return;

            //lobby listener
            let userId = this.userService.getMainUserId();
            if (this.isOnlineInstant) {
                this.lobbySubscription = this.firestoreService.getLobbyDoc(lobbyId!).snapshotChanges().subscribe(snapshot => {
                    if (snapshot.payload.metadata.hasPendingWrites || this.isBeingDestroyed) return;
                    let lobby = snapshot.payload.data();
                    if (!lobby) return;

                    this.lobby = Object.assign(new Lobby(lobby.runData, lobby.creatorId, lobby.password, lobby.id), lobby);
                    
                    this.checkSetupRun();
                });
            }
            //local lobby
            else {
                this.lobby = new Lobby(this.userService.offlineSettings ?? RunData.getFreeroamSettings(pkg.version, false), userId, null);
                this.userService.offlineSettings = undefined;
                this.checkSetupRun();
            }


            //socket listener
            if (this.userService.user.gameLaunched) //currently this should never be true but issues surrounding it might be fixed in the future
                this.setupSocketListener(OG.mainPort);
            
            this.launchListener = (window as any).electron.receive("og-launched", (port: number) => {
                this.setupSocketListener(port);
            });

        });
    }

    private checkSetupRun() {
        if (!this.run)
            this.setupRun();

        this.onLobbyChange();
    }

    public setupSocketListener(port: number, tries: number = 0) {
        const localPlayer = this.userService.localUsers.find(x => x.socketHandler.socketPort === port);
        if (!localPlayer) {
            this.userService.sendNotification("Game startup detected with no user tied to it!");
            return;
        }

        if (tries > 20) {
            this.userService.sendNotification("Run handler failed to obtain socket connection!");
            return;
        }

        if (!localPlayer.socketHandler.socketConnected) {
            setTimeout(() => {
                this.setupSocketListener(port, (tries + 1));
            }, 500);
            return;
        }


        localPlayer.socketHandler.ogSocket.pipe(finalize(() => { 
            this.sendEvent(EventType.GameClosed, localPlayer.user.id);
        })).subscribe(target => {
            if (!localPlayer) {
                console.log("Missing local player!")
                return;
            }

            const positionData = new UserPositionData(target.position, localPlayer.socketHandler.timer.totalMs ?? 0, localPlayer.user);

            //handle position
            if (localPlayer.socketHandler.localTeam !== undefined)
                this.sendPosition(positionData);

            //handle game state changes for current player
            if (target.state)
                this.handleStateChange(localPlayer, target.state);

            if (target.levels)
                localPlayer.cleanupHandler.onLevelsUpdate(target.levels, localPlayer.socketHandler);
            
            // check for run end
            if (Task.isRunEnd(positionData) && this.run) {
                const task: GameTaskLevelTime = GameTaskLevelTime.fromPositionData(positionData);
                this.zone.run(() => {
                    localPlayer!.state = PlayerState.Finished;
                    this.sendEvent(EventType.EndPlayerRun, localPlayer!.user.id, task);
                });
            }
        });
    }


    async onLobbyChange() {
        const userId = this.userService.getMainUserId();
        if (!this.lobby) return;

        console.log("Got Lobby Change!");
        //become master if needed (for example host disconnect or no host at start)
        if (this.shouldBecomeHost(userId)) {
            let player = this.run?.getPlayer(userId);
            if (!player) return;

            console.log("Becomming host!");
            if (this.isOnlineInstant)
                await this.firestoreService.deleteLobbySubCollections(this.lobby.id);

            if (this.localSlave)
                this.run?.removePlayer(this.localSlave.hostId);

            this.resetUser();
            this.lobby.host = player.user;

            if (this.lobby.backupHost?.id === userId) //replace backup host if user was backup, host is kicked out of user list and lobby host role by backupHost on data channel disconnect
                this.getNewBackupHost();

            this.userService.localUsers.forEach(localPlayer => {
                if (this.lobby && !this.lobby.hasUser(userId))
                    this.lobby.addUser(new LobbyUser(localPlayer.user.getUserBaseWithDisplayName(), false));
            });

            this.lobby.users = this.lobby.users.filter(x => x.isRunner || this.run?.hasSpectator(x.id));

            if (this.isOnlineInstant) {
                await this.updateFirestoreLobby();
                this.setupMaster();
            }
            this.connected = true;
        }


        //slave checks on lobby change
        if (this.isOnlineInstant && !this.localMaster) {
            //kill current slave connection if new host
            if (this.localSlave?.hostId !== this.lobby.host?.id)
                this.resetUser();

            //become slave if not already and master exists
            if (!this.localSlave && this.lobby.host)
                this.setupSlave();
        }
    }

    setupLocalMainPlayer(localMain: LocalPlayerData) {
        if (!this.run) return;

        this.userService.resetLocalPlayersToNewMain(localMain);

        this.run.spectators.push(new Player(localMain.user.getUserBaseWithDisplayName()));
        localMain.socketHandler.startDrawPlayers();

        if (!this.isOnlineInstant) {
          this.onLobbyChange();
          if (this.isPracticeTool) {
            this.sendEvent(EventType.ChangeTeam, localMain.user.id, 0);
            localMain.updateTeam(this.run.getPlayerTeam(localMain.user.id));
          }
        }
    }

    setupLocalSecondaryPlayer(localPlayer: LocalPlayerData, teamId: number) {
        if (!this.run) return;

        this.run.spectators.push(new Player(localPlayer.user.getUserBaseWithDisplayName()));
        this.sendEvent(EventType.Connect, localPlayer.user.id, localPlayer.user.getUserBaseWithDisplayName());
        this.sendEvent(EventType.ChangeTeam, localPlayer.user.id, teamId);
        localPlayer.updateTeam(this.run.getPlayerTeam(localPlayer.user.id));

        localPlayer.socketHandler.run = this.run;
        localPlayer.socketHandler.startDrawPlayers();
    }

    resetUser() {
        this.dataSubscription?.unsubscribe();
        this.positionSubscription?.unsubscribe();

        if (this.localSlave) {
            this.localSlave.destroy();
            this.localSlave = undefined;
        }
        if (this.localMaster) {
            this.localMaster.destroy();
            this.localMaster = undefined;
        }

        this.connected = false;
    }

    isSpectatorOrNull(userId: string | undefined) {
        return !userId || userId === "" || this.lobby?.hasSpectator(userId);
    }

    getNewBackupHost() {
        if (!this.lobby) return;
        const userId = this.userService.getMainUserId();
        let candidate = this.run?.getAllPlayers().find(player => player.user.id !== userId && player.state !== PlayerState.Disconnected) ?? this.run?.spectators.find(player => player.user.id !== userId && player.state !== PlayerState.Disconnected) ?? null;
        this.lobby.backupHost = candidate ? candidate.user : null;
    }

    shouldBecomeHost(userId: string): boolean {
        if (!this.lobby) return false;
        if ((!this.lobby.host && (!this.lobby.backupHost || this.lobby.backupHost.id === this.userService.getMainUserId())) || (this.lobby.host?.id === userId && !this.localMaster))
            return true;
        else
            return false;
    }

    dehost() { //used only for testing atm, cannot currently be used if host is in a team as he's removed from the team on dehost
        if (!this.localMaster || !this.lobby) return;
        console.log("dehosting");
        this.localMaster.destroy();
        this.localMaster = undefined;
        this.lobby.host = null;
        this.getNewBackupHost();
        this.updateFirestoreLobby();
    }


    setupRun() {
        if (!this.lobby) return;

        console.log("Creating Run!");
        this.run = new Run(this.lobby.runData, this.isPracticeTool);

        this.runSetupCompleteSubject.next(this.run.data);

        //set run info
        if (this.run.data.category == 0)
            this.info = this.run.data.name + "\n\nSame Level: " + this.run.data.requireSameLevel + "\nSolo Zoomers: " + this.run.data.allowSoloHubZoomers + "\nNo LTS: " + this.run.data.noLTS + "\nCitadel Skip: " + CitadelOption[this.run.data.citadelSkip];
        else
            this.info = this.run.data.name + "\n\n" + RunMode[this.run.data.mode] + "\nCategory: " + Category.GetGategories()[this.run.data.category].displayName + "\nSame Level: " + this.run.data.requireSameLevel;
    }

    setupMaster() {
        console.log("Setting up master!");
        this.localMaster = new RTCPeerMaster(this.userService.user.getUserBaseWithDisplayName(), this.firestoreService.getLobbyDoc(this.lobby!.id));
        this.dataSubscription = this.localMaster.eventChannel.subscribe(event => {
            if (!this.localMaster?.isBeingDestroyed)
                this.onDataChannelEvent(event, true);
        });

        if (!this.localMaster.positionChannel) return;
        this.positionSubscription = this.localMaster.positionChannel.subscribe(target => {
            if (!this.localMaster?.isBeingDestroyed)
                this.onPostionChannelUpdate(target, true);
        });
    }

    setupSlave() {
        console.log("Setting up slave!");
        this.localSlave = new RTCPeerSlave(this.userService.user.getUserBaseWithDisplayName(), this.firestoreService.getLobbyDoc(this.lobby!.id), this.lobby!.host!);
        this.dataSubscription = this.localSlave.eventChannel.subscribe(event => {
            if (!this.localSlave?.isBeingDestroyed)
                this.onDataChannelEvent(event, false);
        });

        if (!this.localSlave.positionChannel) return;
        this.positionSubscription = this.localSlave.positionChannel.subscribe(target => {
            if (!this.localSlave?.isBeingDestroyed)
                this.onPostionChannelUpdate(target, false);
        });
    }

    sendEventAsMain(type: EventType, value: any = null) {
        this.sendEventCommonLogic(new DataChannelEvent(this.userService.getMainUserId(), type, value));
    }

    sendEvent(type: EventType, userId: string, value: any = null) {
        this.sendEventCommonLogic(new DataChannelEvent(userId, type, value));
    }

    private sendEventCommonLogic(event: DataChannelEvent) {
        if (this.localSlave) {
            if (this.isOnlineInstant)
                this.localSlave.peer.sendEvent(event);
            this.onDataChannelEvent(event, false); //to run on a potentially safer but slower mode disable this and send back the event from master/host
        }
        else if (this.localMaster && this.lobby?.host?.id === this.userService.getMainUserId() && !this.localMaster.isBeingDestroyed)
            this.onDataChannelEvent(event, true);

        else if (!this.isOnlineInstant)
            this.onDataChannelEvent(event, true);
    }

    sendPosition(positionData: UserPositionData) {
        this.sendPositionToRemote(positionData);

        //update for local instances
        this.userService.localUsers.forEach(localP => {
            if (positionData.userId !== localP.user.id)
                localP.socketHandler.updatePlayerPosition(positionData);
        });
    }

    private sendPositionToRemote(positionData: UserPositionData) {
        if (!this.isOnlineInstant) return;

        if (this.localSlave) {
            this.localSlave.peer.sendPosition(positionData);
        }
        else if (this.localMaster && this.lobby?.host?.id === this.userService.getMainUserId() && !this.localMaster.isBeingDestroyed)
            this.localMaster?.relayPositionToSlaves(positionData);
    }

    onPostionChannelUpdate(positionData: UserPositionData, isMaster: boolean) {
        if (!this.run) return;
        //send updates from master to all slaves
        if (isMaster && this.isOnlineInstant)
            this.localMaster?.relayPositionToSlaves(positionData);

        this.userService.localUsers.forEach(localPlayer => {
            if (positionData.userId !== localPlayer.user.id)
                localPlayer.socketHandler.updatePlayerPosition(positionData);
        });
    }

    onDataChannelEvent(event: DataChannelEvent, isMaster: boolean) {
        if (!this.run) return;
        const userId = this.userService.getMainUserId();

        //send updates from master to all slaves | this should be here and not moved up to sendEvent as it's not the only method triggering this
        if (isMaster && this.isOnlineInstant && event.type !== EventType.RequestRunSync && event.type !== EventType.RunSync)
            this.localMaster?.relayToSlaves(event);

        switch (event.type) {

            case EventType.Connect: //rtc stuff on connection is setup individually in rtc-peer-master/slave
                const newUser: UserBase = event.value as UserBase;
                console.log(newUser.name + " connected!");

                if (isMaster) {
                    //handle run
                    const isRunner: boolean = (this.run.getPlayerTeam(newUser.id) !== undefined);
                    if (isRunner)
                        this.sendEventAsMain(EventType.Reconnect, newUser.id);
                    else if (!this.run.hasSpectator(newUser.id))
                        this.run!.spectators.push(new Player(newUser));

                    //handle lobby
                    if (!this.lobby?.hasUser(newUser.id)) {
                        this.lobby?.addUser(new LobbyUser(newUser, isRunner));
                        this.updateFirestoreLobby();
                    }
                    else if ((this.lobby.hasRunner(newUser.id) && !isRunner) || (this.lobby.hasSpectator(newUser.id) && isRunner)) {
                        this.lobby!.getUser(newUser.id)!.isRunner = isRunner;
                        this.updateFirestoreLobby();
                    }
                }
                else if (event.userId === userId) {
                    this.sendEventAsMain(EventType.RequestRunSync, new SyncRequest(userId, SyncRequestReason.InitConnect));
                }
                else if (!this.run.hasSpectator(newUser.id) && !this.userService.localUsers.some(x => x.user.id === newUser.id))
                    this.run!.spectators.push(new Player(newUser));

                break;


            case EventType.Disconnect:
                if (!this.lobby) return;
                const disconnectedUser: UserBase = event.value as UserBase;

                //remove if recording
                this.userService.localUsers.forEach(localPlayer => {
                    if (!localPlayer.socketHandler.checkRemoveRecording(disconnectedUser.id))
                        localPlayer.socketHandler.stopDrawPlayer(disconnectedUser.id);
                });
                this.selfImportedRecordings = this.selfImportedRecordings.filter(x => x.id !== disconnectedUser.id);

                //remove from run
                this.zone.run(() => {
                    this.run?.removePlayer(disconnectedUser.id);
                });
                this.updateAllPlayerInfo();

                //host logic
                if (isMaster) {
                    if (this.localMaster?.peers) { //yes this is needed
                        let peer = this.localMaster.peers.find(x => x.user.id === disconnectedUser.id);
                        if (peer) {
                            console.log("Destorying disconnected peer");
                            peer.peer.destroy();
                            this.localMaster!.peers = this.localMaster!.peers.filter(x => x.user.id !== disconnectedUser.id);
                        }
                    }

                    let updateDb = false;

                    if (this.lobby.hasUser(disconnectedUser.id) || this.lobby.runnerIds.includes(disconnectedUser.id)) {
                        this.lobby.removeUser(disconnectedUser.id);
                        updateDb = true;
                    }

                    //host on backupHost disconnect
                    if (disconnectedUser.id === this.lobby.backupHost?.id) {
                        this.getNewBackupHost();
                        updateDb = true;
                    }

                    if (updateDb)
                        this.updateFirestoreLobby();
                }
                //backupHost on host disconnect
                else if (event.value === this.lobby.host?.id && this.lobby.backupHost?.id === userId) {
                    this.lobby.host = null; //current user will pickup host role on the file change
                    this.updateFirestoreLobby();
                }
                break;


            case EventType.Kick:
                if (userId === event.value.id && (this.lobby?.host?.id === event.userId || userId === event.userId)) {
                    this.userService.sendNotification("You've been kicked from the lobby.");
                    this.userService.routeTo('/lobby');
                }
                else {
                    let wasLocalPlayer: boolean = false;
                    this.userService.localUsers.forEach(localPlayer => {
                        if (localPlayer.user.id === event.value.id) {
                            localPlayer.onDestroy();
                            wasLocalPlayer = true;
                        }
                    });
                    if (wasLocalPlayer) {
                        this.userService.removeLocalPlayer(event.value.id);
                        this.sendEvent(EventType.Disconnect, event.value.id, event.value);
                    }
                    
                    if (this.selfImportedRecordings.some(x => x.id === event.value.id))
                        this.sendEvent(EventType.Disconnect, event.value.id, event.value);
                }
                break;


            case EventType.GameClosed:
                this.userService.localUsers.forEach(localPlayer => {
                    localPlayer.socketHandler.stopDrawPlayer(event.userId);
                });
                break;


            case EventType.Reconnect:
                this.zone.run(() => {
                    this.run!.reconnectPlayer(event.value);
                });
                break;


            case EventType.RequestRunSync:
                if (isMaster) {
                    this.localMaster?.respondToSlave(new DataChannelEvent(userId, EventType.RunSync, new SyncResponse(event.value, this.run)), event.userId);
                    console.log("Got run sync request, responding!");
                }
                break;


            case EventType.RunSync:
                this.zone.run(() => {

                    //update run
                    let response: SyncResponse = event.value;
                    let run: Run = JSON.parse(JSON.stringify(response.run)); //to not cause referece so that import can run properly on the run after
                    if (response.userId !== null) { //handle single user sync
                        let localPlayer = this.userService.localUsers.find(x => x.user.id === response.userId);
                        if (!localPlayer) return;
                        
                        this.run = Object.assign(new Run(run.data), run).reconstructRun();
                        this.runSyncLocalPlayer(localPlayer, this.run, true);
                    }
                    else { //handle all local users sync
                        this.run = Object.assign(new Run(run.data), run).reconstructRun();
                        this.userService.localUsers.forEach((localPlayer) => {
                            this.runSyncLocalPlayer(localPlayer, this.run!, true);
                        });
                    }
                    this.connected = true;
                });
                break;



            case EventType.EndPlayerRun:
                this.zone.run(() => {
                    if (!this.run) return;
                    const endTask: GameTaskLevelTime = event.value;
                    this.run.addSplit(new Task(endTask));

                    this.run.endPlayerRun(event.userId, endTask.name === Task.forfeit);
                    RunMod.endRunOnSigleTeamFinish(this.run.data.mode) ? this.run.endAllTeamsRun(endTask) : this.run?.endTeamRun(endTask);
                    
                    let playerTeam = this.run.getPlayerTeam(userId);
                    if (!playerTeam || !playerTeam.everyoneHasFinished())
                        return;

                    let recordings: UserRecording[] | undefined = this.getMainLocalPlayer()?.socketHandler.resetGetRecordings();
                    this.checkSaveRecordingsLocally(recordings, playerTeam);
                    
                    this.checkTeamGameVersions(playerTeam); //!TODO: Should be check earlier than run end.
                    this.run.checkRunEndValid();
                    if (!playerTeam.runIsValid && playerTeam.runInvalidReason) this.userService.sendNotification(playerTeam.runInvalidReason.startsWith("Run invalid") ? playerTeam.runInvalidReason : ("Run Invalid: " + playerTeam.runInvalidReason), 10000);

                    if (isMaster && this.run.isMode(RunMode.Speedrun) && !this.isPracticeTool && this.run.everyoneHasFinished() && this.run.teams.some(x => x.runIsValid)) {
                        const players: Player[] = this.run.getAllPlayers();
                        this.firestoreService.getUsers().then(collection => {
                            if (!collection || !players || !this.run) return;
                            
                            let signedInPlayers: string[] = players.filter(player => collection.users.some(user => user.id === player.user.id)).flatMap(x => x.user.id);
                            let dbRun: DbRun = DbRun.convertToFromRun(this.run);
                        
                            // add run to history if any player is signed in
                            if (players.some(player => collection.users.find(user => user.id === player.user.id)))
                                this.firestoreService.addRun(dbRun);
                            
                            // add pb
                            if (this.run?.data.submitPbs) {
                                const pbUploadSubscription = dbRun.checkUploadPbs(this.firestoreService, signedInPlayers, recordings)?.subscribe(pbUsers => {
                                    pbUploadSubscription?.unsubscribe();
                                    if (pbUsers.length !== 0) {
                                        setTimeout(() => { //give some time for pb to upload !TODO: replace with proper pipe
                                            this.sendEventAsMain(EventType.NewPb, pbUsers);
                                        }, 1000);
                                    }
                                });
                            }
                        });
                    }
                });
                break;
            
            case EventType.NewPb:
                let pbUsers: PbTeamPlayers[] = event.value;
                for (let pbTeam of pbUsers) {
                    if (pbTeam.playerIds.includes(userId)) {
                        if (this.pbSubscription) this.pbSubscription.unsubscribe();
                        let currentPbData: DbPb | undefined = undefined;
                        this.pbSubscription = this.firestoreService.getPb(pbTeam.pbId).subscribe(pb => {
                            if (!pb?.category) return; //checking category specifically because the id is returned if none is found
                            if (currentPbData)
                                currentPbData = pb; //incase it gets updated while writing a comment
                            else {
                                currentPbData = pb;
                                const dialogSubscription = this.dialog.open(PbCommentDialogComponent, { data: { newPb: true } }).afterClosed().subscribe((content: DbRunUserContent) => {
                                  dialogSubscription.unsubscribe();
                                    if (content) {
                                        content.userId = userId;
                                        pb = Object.assign(new DbPb(), pb);
                                        pb.userContent = pb.userContent.filter(x => x.userId !== content.userId);
                                        pb.userContent.push(content);
                                        this.pbSubscription.unsubscribe();
                                        this.firestoreService.updatePb(pb);
                                  }
                                });
                            }
                        });
                    }
                }
                break;
            
            case EventType.ImportRecordings:
                let recPackage: RecordingPackage = event.value;
                this.userService.localUsers.forEach(localPlayer => {
                    recPackage.recordings.forEach(rec => {
                    let forceState: boolean = recPackage.forceState !== undefined;
                    localPlayer.socketHandler.addRecording(rec, forceState ? recPackage.forceState! : localPlayer.socketHandler.localTeam?.id === recPackage.teamId ? MultiplayerState.interactive : MultiplayerState.active, forceState);
                    });
                });
                break;
                
            case EventType.NewPlayerState:
                this.zone.run(() => {
                    this.run!.updateState(event.userId, event.value, this.userService);
                });
                break;

            case EventType.ChangeTeam:
                this.zone.run(() => {
                    const user = this.run?.getPlayer(event.userId)?.user;
                    this.run?.changeTeam(user, event.value);
                    this.updateAllPlayerInfo();
                });

                if (!isMaster) break;
                const user: LobbyUser | undefined = this.lobby?.getUser(event.userId);
                if (!user || user.isRunner) break;

                user.isRunner = true;
                if (!this.lobby!.runnerIds.includes(user.id))
                    this.lobby!.runnerIds.push(user.id);
                this.updateFirestoreLobby();
                break;


            case EventType.ChangeTeamName:
                let team = this.run.getTeam(event.value.id);
                if (!team) return;
                this.zone.run(() => {
                    team!.name = event.value.name;
                });
                break;


            case EventType.Ready:
                //repeat for locals
                if (event.userId === userId) {
                    for (let localPlayer of this.userService.localUsers) {
                        if (localPlayer.user.id === userId) continue;
                        localPlayer.state = event.value;
                        this.sendEvent(EventType.Ready, localPlayer.user.id, event.value);
                    }
                    this.selfImportedRecordings.forEach(recPlayer => {
                        this.sendEvent(EventType.Ready, recPlayer.id, event.value);
                    })
                }
                
                this.zone.run(() => {
                    this.run!.toggleReady(event.userId, event.value);
                });

                //check if everyone is ready, send start call if so
                if (isMaster && event.value === PlayerState.Ready && this.run!.everyoneIsReady()) {
                    if (this.run.data.mode !== RunMode.Casual) {
                        this.lobby!.visible = false;
                        this.updateFirestoreLobby();
                    }

                    this.sendEventAsMain(EventType.StartRun, new Date().toUTCString());
                }
                break;


            case EventType.StartRun:
                if (this.run.timer.runState === RunState.Waiting) { //locals players and recordings will also ready up and repeat run start
                    this.zone.run(() => {
                        this.run!.start(new Date());
                    });
                    this.setupRunStart();
                }
                break;


            case EventType.ToggleReset:
                //repeat for locals
                if (event.userId === userId) {
                    for (let localPlayer of this.userService.localUsers) {
                        if (localPlayer.user.id === userId) continue;
                        localPlayer.state = event.value;
                        this.sendEvent(EventType.ToggleReset, localPlayer.user.id, event.value);
                    }
                    this.selfImportedRecordings.forEach(recPlayer => {
                        this.sendEvent(EventType.ToggleReset, recPlayer.id, event.value);
                    })
                }

                this.zone.run(() => {
                    if (this.run!.toggleVoteReset(event.userId, event.value)) {
                        this.userService.localUsers.forEach(localPlayer => {
                            if (this.run?.hasSpectator(localPlayer.user.id)) {
                                localPlayer.socketHandler.addCommand(OgCommand.DisableSpectatorMode);
                                localPlayer.socketHandler.forceCheckpointSpawn("village1-hut");
                            }

                            localPlayer.socketHandler.addCommand(OgCommand.Trip);
                            localPlayer.socketHandler.addCommand(OgCommand.EnableDebugMode);
                            localPlayer.socketHandler.updateGameSettings(new GameSettings(RunData.getFreeroamSettings(pkg.version)));
                            localPlayer.socketHandler.resetTimer();
                            localPlayer.state = PlayerState.Neutral;
                        });
                    }
                });
                break;


            default:
                console.log("MISSING EVENT TYPE IMPLEMENTATION!", EventType[event.type]);
        }
    }

    getMainLocalPlayer(): LocalPlayerData | undefined {
        return this.userService.localUsers.find(x => x.user.id === this.userService.getMainUserId() || x.socketHandler.socketPort === OG.mainPort) ?? this.userService.localUsers[0]; 
    }

    updateAllPlayerInfo() {
        if (!this.run) return;
        this.run.getAllPlayers().forEach(player => {
            this.userService.localUsers.forEach(localPlayer => {
                localPlayer.socketHandler.updatePlayerInfo(player.user.id, this.run!.getRemotePlayerInfo(player.user.id));
            });
        });
    }

    checkSaveRecordingsLocally(recordings: UserRecording[] | undefined, playerTeam: Team) {
        //!TODO: Add support for saving secondary locals recordings if on different team?
        if (!recordings)
            this.userService.sendNotification("Failed to fetch run recordings!");
        else if (this.userService.user.saveRecordingsLocally && recordings) { 
            let userTeamPlayerIds: string[] = playerTeam.players.flatMap(x => x.user.id) ?? [];
            let userTeamRecordings = recordings.filter(x => userTeamPlayerIds.includes(x.userId));
            if (userTeamRecordings.length === 0)
                this.userService.sendNotification("Failed to fetch users team run recordings!");
            else
                (window as any).electron.send('recordings-write', [new RecordingFile(pkg.version, this.userService.user.gameVersion, userTeamRecordings)]);
        }
    }

    checkTeamGameVersions(playerTeam: Team) {
        if (!this.run?.isMode(RunMode.Casual)) {
            if (!playerTeam.everyoneOnSameVersion())
                playerTeam.checkMarkRunInvalid(false, "OpenGOAL version mismatch.");

            let mainLocalPlayer = this.getMainLocalPlayer();
            if (mainLocalPlayer && mainLocalPlayer.socketHandler.localTeam?.id === playerTeam.id && this.isHost() && playerTeam.players.find(x => x.user.id === mainLocalPlayer?.user.id)?.gameState.gameVersion !== ("v" + this.userService.user.gameVersion))
                playerTeam.checkMarkRunInvalid(false, "OpenGOAL version mismatch.");
        }
    }

    //used by both run component and practice/recording tool
    setupRunStart() {
        if (!this.run) return;

        this.updateAllPlayerInfo();
        
        this.run.teams.forEach(team => {
            team.resetForRun(false);
        });

        let fetchedPbs: DbPb[] = [];

        for (let localPlayer of this.userService.localUsers) {
            let playerTeam = this.run.getPlayerTeam(localPlayer.user.id);
            if (!playerTeam) continue;

            const playerIds = playerTeam.players.flatMap(x => x.user.id);
            if (localPlayer.user.hasSignedIn && !this.isPracticeTool && this.run.isMode(RunMode.Speedrun) && this.run.data.category !== CategoryOption.Custom && !this.run.hasSpectator(localPlayer.user.id)) {
                if (DbPb.belongsToRunners(localPlayer.socketHandler.currentPb, this.run.data, playerIds))
                    continue;
                else
                    localPlayer.socketHandler.setCurrentPb(undefined);
                
                //set current pb if any
                let pbAlreadyFetched = false;

                for (let pb of fetchedPbs) {
                    if (DbPb.belongsToRunners(pb, this.run.data, playerIds)) {
                        localPlayer.socketHandler.setCurrentPb(pb);
                        pbAlreadyFetched = true;
                        break;
                    }
                }

                if (!pbAlreadyFetched) {
                    const pbSubscription = this.firestoreService.getUsersCurrentPb(this.run.data.category, playerIds.length === 1 ? false : this.run.data.requireSameLevel, playerIds).subscribe(pbs => {
                        pbSubscription.unsubscribe();
                        if (pbs && pbs.length !== 0) { 
                            localPlayer.socketHandler.setCurrentPb(pbs[0]);
                            fetchedPbs.push(pbs[0]);
                        }
                    });
                }
            }

            localPlayer.updateTeam(this.run?.getPlayerTeam(localPlayer.user.id, localPlayer.user.id !== this.userService.getMainUserId())); //last param gives new team to none main FFA users
        }
    }

    async updateFirestoreLobby() {
        let userId = this.userService.getMainUserId();
        if (!this.isOnlineInstant || !this.lobby || !(this.lobby?.backupHost?.id === userId || this.lobby?.host?.id === userId || this.lobby?.host === null)) return;
        this.lobby.lastUpdateDate = new Date().toUTCString();
        await this.firestoreService.updateLobby(this.lobby);
    }

    importRecordingsFromLocal(recordingPackage: RecordingPackage) {
        recordingPackage.recordings.forEach(recording => {
          const recUser = Recording.getUserBase(recording);
          this.selfImportedRecordings.push(recUser);
          this.sendEvent(EventType.Connect, recUser.id, recUser);
          this.sendEvent(EventType.ChangeTeam, recUser.id, recordingPackage.teamId);
        });
  
        this.sendEventAsMain(EventType.ImportRecordings, recordingPackage);
    }

    removeAllSelfRecordings() {
        this.selfImportedRecordings.forEach(recUser => {
              this.sendEvent(EventType.Disconnect, recUser.id, recUser);
        });
        this.userService.localUsers.forEach(localPlayer => {
            localPlayer.socketHandler.resetGetRecordings();
        });
    }

    runSyncLocalPlayer(localPlayer: LocalPlayerData, run: Run, reconstructTimer: boolean) {
        if (!this.run) return;

        localPlayer.socketHandler.timer.importTimer(run.timer);
        if (reconstructTimer) this.run.reconstructTimer(localPlayer.socketHandler.timer);
        localPlayer.socketHandler.run = this.run;

        //update player and team
        localPlayer.mode = this.run.data.mode;
        let playerTeam = this.run.getPlayerTeam(localPlayer.user.id, localPlayer.user.id !== this.userService.getMainUserId());
        if (playerTeam)
            localPlayer.updateTeam(playerTeam);

        localPlayer.cleanupHandler.resetHandler();
    }


    handleStateChange(localPlayer: LocalPlayerData, state: GameState) {
        this.zone.run(() => {
            if (!this.run || this.isSpectatorOrNull(localPlayer.user.id) || localPlayer.state === PlayerState.Finished) return;
            
            if (state.justSpawned && localPlayer.socketHandler.inMidRunRestartPenaltyWait !== 0) {
                if (RunMod.usesMidGameRestartPenaltyLogic(this.run.data.mode)) {
                    state.debugModeActive = false;
                    localPlayer.socketHandler.addCommand(OgCommand.TargetGrab);
                    this.userService.sendNotification("Mid run restart penalty applied, you will be released in " + localPlayer.socketHandler.inMidRunRestartPenaltyWait + " seconds.", 10000);
                }
                else if (localPlayer.socketHandler.localTeam)
                    localPlayer.importRunStateHandler(localPlayer.socketHandler.localTeam.runState, SyncType.Full);
            }

            this.sendEvent(EventType.NewPlayerState, localPlayer.user.id, state);

            const previousCheckpoint = localPlayer.gameState.currentCheckpoint;
            localPlayer.gameState = state;
            if (state.justSpawned || state.justSaved || state.justLoaded || previousCheckpoint !== state.currentCheckpoint)
                localPlayer.checkDesync(this.run!);
        })
    }

    isHost(): boolean {
        return !this.isOnlineInstant || (this.localMaster !== undefined && this.lobby?.host?.id === this.userService.getMainUserId());
    }


    destroy() {
        this.isBeingDestroyed = true;
        const userId = this.userService.getMainUserId();
        const wasHost: boolean = this.isHost() && this.isOnlineInstant;

        //disconnect recordings
        this.removeAllSelfRecordings();

        //disconnect local users
        this.userService.localUsers.forEach(localPlayer => {
            if (localPlayer.user.id !== userId)
                this.sendEvent(EventType.Disconnect, localPlayer.user.id, localPlayer.user.getUserBase());
        });

        //hide lobby if causal
        if (wasHost && this.run?.isMode(RunMode.Casual) && this.lobby!.visible) {
            this.lobby!.visible = false;
            this.updateFirestoreLobby();
        }

        //reset main user
        this.resetUser();

        //unsubscribes
        this.lobbySubscription?.unsubscribe();
        this.userSetupSubscription?.unsubscribe();
        this.pbSubscription?.unsubscribe();
        this.launchListener();

        //remove demote if host
        if (this.lobby && (wasHost || this.lobby?.host === null)) { //host removes user from lobby otherwise but host has to the job for himself
            if (wasHost) {
                console.log("Removing host!")
                this.lobby.host = null;
            }

            this.userService.localUsers.forEach(localPlayer => {
                this.lobby!.removeUser(localPlayer.user.id);
            });

            this.updateFirestoreLobby();
        }

        this.userService.removeAllExtraLocals();
    }
}