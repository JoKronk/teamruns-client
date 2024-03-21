import { Run } from "./run";
import { RunMode } from "./run-mode";
import { LocalPlayerData } from "../user/local-player-data";
import { Lobby } from "../firestore/lobby";
import { RTCPeerMaster } from "../peer/rtc-peer-master";
import { RTCPeerSlave } from "../peer/rtc-peer-slave";
import { UserService } from "src/app/services/user.service";
import { Subscription } from "rxjs";
import { DataChannelEvent } from "../peer/data-channel-event";
import { EventType } from "../peer/event-type";
import { PlayerState } from "../player/player-state";
import { RunState } from "./run-state";
import { NgZone } from "@angular/core";
import { Task } from "../opengoal/task";
import { LobbyUser } from "../firestore/lobby-user";
import { User, UserBase } from "../user/user";
import { FireStoreService } from "src/app/services/fire-store.service";
import { CitadelOption, RunData } from "./run-data";
import { Player } from "../player/player";
import { Category } from "./category";
import { DbRun } from "../firestore/db-run";
import { UserPositionData } from "../socket/position-data";
import { GameState } from "../opengoal/game-state";
import { Team } from "./team";
import pkg from 'app/package.json';
import { RunStateHandler } from "../level/run-state-handler";
import { OgCommand } from "../socket/og-command";
import { GameSettings } from "../socket/game-settings";
import { SyncRequest, SyncRequestReason } from "./sync-request";
import { SyncResponse } from "./sync-response";
import { OG } from "../opengoal/og";
import { DbRecordingFile, RecordingFile } from "../socket/recording-file";
import { PbCommentDialogComponent } from "src/app/dialogs/pb-comment-dialog/pb-comment-dialog.component";
import { DbRunUserContent } from "../firestore/db-run-user-content";
import { MatDialog } from "@angular/material/dialog";
import { DbPb } from "../firestore/db-pb";

export class RunHandler {

    lobby: Lobby | undefined;
    run: Run | undefined;

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
    private launchListener: any;

    constructor(lobbyId: string | undefined,
        public firestoreService: FireStoreService,
        public userService: UserService,
        public dialog: MatDialog,
        public zone: NgZone,
        public isPracticeTool: boolean = false) {
        
        this.isOnlineInstant = lobbyId !== undefined;
        this.zone = zone;

        //lobby listener
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
            this.lobby = new Lobby(this.userService.offlineSettings ?? RunData.getFreeroamSettings(pkg.version), this.userService.getId(), null);
            this.userService.offlineSettings = undefined;
            this.checkSetupRun();
        }


        //position listener
        if (this.userService.user.gameLaunched)
            this.setupSocketListener(OG.mainPort);
        this.launchListener = (window as any).electron.receive("og-launched", (port: number) => {
            this.setupSocketListener(port);
        });
    }

    private checkSetupRun() {
        if (!this.run) {
            this.setupRun();
            
            this.userService.localUsers.forEach(localPlayer => {
                localPlayer.socketHandler.startDrawPlayers();
            });
        }

        this.onLobbyChange();
    }

    public setupSocketListener(port: number) {
        const localPlayer = this.userService.localUsers.find(x => x.socketHandler.socketPort === port);
        if (!localPlayer) {
            this.userService.sendNotification("Game startup detected with no user tied to it!");
            return;
        }

        localPlayer.socketHandler.ogSocket.subscribe(target => {
            if (!localPlayer) {
                console.log("Missing local player!")
                return;
            }

            const positionData = new UserPositionData(target.position, localPlayer.socketHandler.timer.totalMs ?? 0, localPlayer.user);

            //handle position
            if (localPlayer.getTeam() !== undefined) {
                this.sendPosition(positionData);

                //update for local instances
                this.userService.localUsers.forEach(localP => {
                    if (positionData.userId !== localP.user.id)
                        localP.socketHandler.updatePlayerPosition(positionData);
                });
            }

            //handle game state changes for current player
            if (target.state)
                this.handleStateChange(localPlayer, target.state);

            if (target.levels)
                localPlayer.levelHandler.onLevelsUpdate(target.levels, localPlayer.socketHandler);
            
            // check for run end
            if (Task.isRunEnd(positionData)) {
                this.zone.run(() => {
                    localPlayer!.state = PlayerState.Finished;
                    this.sendEvent(EventType.EndPlayerRun, localPlayer!.user.id, positionData);
                });
            }
        });
    }


    private async onLobbyChange() {
        const userId = this.userService.getId();
        if (!this.lobby) return;

        console.log("Got Lobby Change!");
        //become master if needed (for example host disconnect or no host at start)
        if (this.shouldBecomeHost(userId)) {
            let player = this.getUser(userId);
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
                    this.lobby.addUser(new LobbyUser(localPlayer.user, false));
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

    getUser(userId: string): Player | undefined {
        return this.run?.getPlayer(userId);
    }

    isSpectatorOrNull(userId: string | undefined) {
        return !userId || userId === "" || this.lobby?.hasSpectator(userId);
    }

    getNewBackupHost() {
        if (!this.lobby) return;
        const localPlayer = this.getMainLocalPlayer();
        let candidate = this.run?.getAllPlayers().find(player => player.user.id !== localPlayer.user.id && player.state !== PlayerState.Disconnected) ?? this.run?.spectators.find(player => player.user.id !== localPlayer.user.id && !player.user.id.startsWith("OBS-") && player.state !== PlayerState.Disconnected) ?? null;
        this.lobby.backupHost = candidate ? candidate.user : null;
    }

    shouldBecomeHost(userId: string): boolean {
        if (!this.lobby) return false;
        if ((!this.lobby.host && (!this.lobby.backupHost || this.lobby.backupHost.id === this.getMainLocalPlayer().user.id)) || (this.lobby.host?.id === userId && !this.localMaster))
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
        this.run = new Run(this.lobby.runData, this.getMainLocalPlayer().socketHandler.timer);

        this.userService.localUsers.forEach(localPlayer => {
            localPlayer.socketHandler.run = this.run;
        });

        if (this.isOnlineInstant) {
            this.getMainLocalPlayer().user = this.userService.user;

            this.userService.localUsers.forEach(localPlayer => {
                localPlayer.mode = this.run!.data.mode;
                this.run!.spectators.push(new Player(localPlayer.user));
            });
        }
        else {
            setTimeout(() => { //lousy way to make sure userId has loaded in before we change team !TODO: Replace
                //setup local user (this should be done here or at some point that isn't instant to give time to load in the user if a dev refresh happens while on run page)
                this.getMainLocalPlayer().user = this.userService.user;
    
                this.userService.localUsers.forEach(localPlayer => {
                    localPlayer.mode = this.run!.data.mode;
                    this.run!.spectators.push(new Player(localPlayer.user));
    
                    this.sendEvent(EventType.ChangeTeam, localPlayer.user.id, 0);
                    localPlayer.updateTeam(this.run?.getPlayerTeam(this.userService.getId()));
                });
                this.onLobbyChange();
    
            }, 300);
        }


        //set run info
        if (this.run.data.category == 0)
            this.info = this.run.data.name + "\n\nSame Level: " + this.run.data.requireSameLevel + "\nSolo Zoomers: " + this.run.data.allowSoloHubZoomers + "\nNo LTS: " + this.run.data.noLTS + "\nCitadel Skip: " + CitadelOption[this.run.data.citadelSkip];
        else
            this.info = this.run.data.name + "\n\n" + RunMode[this.run.data.mode] + "\nCategory: " + Category.GetGategories()[this.run.data.category].displayName + "\nSame Level: " + this.run.data.requireSameLevel;
    }

    setupMaster() {
        console.log("Setting up master!");
        this.localMaster = new RTCPeerMaster(this.userService.user.createUserBaseFromDisplayName(), this.firestoreService.getLobbyDoc(this.lobby!.id));
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
        this.localSlave = new RTCPeerSlave(this.userService.user.createUserBaseFromDisplayName(), this.firestoreService.getLobbyDoc(this.lobby!.id), this.lobby!.host!);
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
        this.sendEventCommonLogic(new DataChannelEvent(this.userService.getId(), type, value));
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
        else if (this.localMaster && this.lobby?.host?.id === this.getMainLocalPlayer().user.id && !this.localMaster.isBeingDestroyed)
            this.onDataChannelEvent(event, true);

        else if (!this.isOnlineInstant)
            this.onDataChannelEvent(event, true);
    }


    sendPosition(positionData: UserPositionData) {
        if (!this.isOnlineInstant) return;

        if (this.localSlave) {
            this.localSlave.peer.sendPosition(positionData);
        }
        else if (this.localMaster && this.lobby?.host?.id === this.getMainLocalPlayer().user.id && !this.localMaster.isBeingDestroyed)
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
        const userId = this.userService.getId();

        //send updates from master to all slaves | this should be here and not moved up to sendEvent as it's not the only method triggering this
        if (isMaster && this.isOnlineInstant && event.type !== EventType.RequestRunSync && event.type !== EventType.RunSync)
            this.localMaster?.relayToSlaves(event);

        switch (event.type) {

            case EventType.Connect: //rtc stuff on connection is setup individually in rtc-peer-master/slave
                const newUser: UserBase = event.value as UserBase;
                if (event.userId === "host")
                    this.userService.sendNotification("Client to server fallback communication established,\n please recreate the lobby if peer to peer usually works.", 10000);

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
                else if (event.userId === this.getMainLocalPlayer().user.id) {
                    this.sendEventAsMain(EventType.RequestRunSync, new SyncRequest(this.getMainLocalPlayer().user.id, SyncRequestReason.InitConnect));
                }
                else if (!this.run.hasSpectator(newUser.id))
                    this.run!.spectators.push(new Player(newUser));

                break;


            case EventType.Disconnect:
                if (!this.lobby) return;
                const disconnectedUser: UserBase = event.value as UserBase;
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
                let mainLocalPlayer = this.getMainLocalPlayer();
                if (mainLocalPlayer.user.id === event.value.id && (this.lobby?.host?.id === event.userId || mainLocalPlayer.user.id === event.userId)) {
                    this.userService.sendNotification("You've been kicked from the lobby.");
                    this.userService.routeTo('/lobby');
                }
                else if (isMaster && event.value.id.startsWith("OBS-"))
                    this.sendEventAsMain(EventType.Disconnect, event.value);
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
                }
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
                        
                        this.run = Object.assign(new Run(run.data, localPlayer.socketHandler.timer), run).reconstructRun();
                        this.runSyncLocalPlayer(localPlayer, run, true);
                    }
                    else { //handle all local users sync
                        this.run = Object.assign(new Run(run.data, this.getMainLocalPlayer().socketHandler.timer), run).reconstructRun();
                        this.userService.localUsers.forEach((localPlayer, i) => {
                            this.runSyncLocalPlayer(localPlayer, run, i === 0);
                        });
                    }
                    this.connected = true;
                });
                break;



            case EventType.EndPlayerRun:
                this.zone.run(() => {
                    if (Task.isRunEnd(event.value))
                        this.run!.addSplit(new Task(event.value));

                    if (!this.run) return;

                    this.run.endPlayerRun(event.userId, event.value.name === Task.forfeit);
                    this.run.isMode(RunMode.Lockout) ? this.run.endAllTeamsRun(event.value) : this.run?.endTeamRun(event.value);
                    
                    let players: Player[] = this.run.getAllPlayers();
                    let recordings: DbRecordingFile[] = [];
                    this.getMainLocalPlayer().socketHandler.resetGetRecordings().forEach(recording => {
                        recordings.push(new DbRecordingFile(pkg.version, recording, players.find(x => x.user.id === recording.userId)?.user.name));
                    });
                    
                    if (this.userService.user.saveRecordingsLocally)
                        (window as any).electron.send('recordings-write', recordings);

                    this.run.checkRunEndValid();
                    if (!this.isPracticeTool && this.run.teams.some(x => x.runIsValid)) {

                        if (isMaster) {
                            let run: DbRun = DbRun.convertToFromRun(this.run);
    
                            this.firestoreService.getUsers().then(collection => {
                                const players = this.run?.getAllPlayers();
                                if (!collection || !players) return;
                                // add run to history if any player is signed in
                                if (players.some(player => collection.users.find(user => user.id === player.user.id)))
                                    this.firestoreService.addRun(run);
                                // add pb & leadeboard data if all players are signed in
                                if (this.run?.data.submitPbs && players.every(player => collection.users.find(user => user.id === player.user.id))) {
                                    let pbUsers: Map<string, string[]> = run.checkUploadPbs(this.firestoreService, recordings);
                                    if (pbUsers.size !== 0)
                                        this.sendEventAsMain(EventType.NewPb, pbUsers);
                                }
                            });
                        }
                    }
                });
                break;
            
            case EventType.NewPb:
                let pbUsers: Map<string, string[]> = event.value;
                pbUsers.forEach((users, pbId) => {
                    let localUserPbs = this.userService.localUsers.filter(localPlayer => users.includes(localPlayer.user.id));
                    if (localUserPbs.length !== 0) {
                        const pbSubscription = this.firestoreService.getPb(pbId).subscribe(pb => {
                            pbSubscription.unsubscribe();
                            if (!pb) return;
                            localUserPbs.forEach(localPlayer => {
                                const dialogSubscription = this.dialog.open(PbCommentDialogComponent, { data: { newPb: true } }).afterClosed().subscribe((content: DbRunUserContent) => {
                                  dialogSubscription.unsubscribe();
                                    if (content) {
                                        content.userId = localPlayer.user.id;
                                        pb = Object.assign(new DbPb(), pb);
                                        pb.userContent = pb.userContent.filter(x => x.userId !== content.userId);
                                        pb.userContent.push(content);
                                        this.firestoreService.updatePb(pb);
                                  }
                                });
                            });
                        });
                    }
                });
                break;
                
            case EventType.NewPlayerState:
                this.zone.run(() => {
                    this.run!.updateState(event.userId, event.value, this.userService);
                });
                break;

            case EventType.ChangeTeam:
                this.zone.run(() => {
                    const user = this.getUser(event.userId)?.user;
                    this.run?.changeTeam(user, event.value);
                });
                this.updateAllPlayerInfo();

                if (!isMaster) break;
                const user: LobbyUser | undefined = this.lobby?.getUser(event.userId);
                if (!user || user.isRunner) break;

                user.isRunner = true;
                if (!this.lobby!.runnerIds.includes(user.id))
                    this.lobby!.runnerIds.push(user.id);
                this.updateFirestoreLobby();
                break;


            case EventType.ChangeTeamName:
                let team = this.run.getPlayerTeam(event.value.id);
                if (!team) return;
                this.zone.run(() => {
                    team!.name = event.value.name;
                });
                break;


            case EventType.Ready:
                this.zone.run(() => {
                    this.run!.toggleReady(event.userId, event.value);
                });

                //check if everyone is ready, send start call if so
                if (isMaster && event.value === PlayerState.Ready && this.run!.everyoneIsReady()) {
                    this.lobby!.visible = false;
                    this.updateFirestoreLobby();

                    this.sendEventAsMain(EventType.StartRun, new Date().toUTCString());
                }
                break;


            case EventType.StartRun:
                this.zone.run(() => {
                    this.run!.start(new Date());
                    this.userService.localUsers.forEach(localPlayer => {
                        localPlayer.socketHandler.addCommand(OgCommand.SetupRun);
                    });
                });
                this.setupRunStart();
                break;


            case EventType.ToggleReset:
                this.zone.run(() => {
                    if (this.run!.toggleVoteReset(event.userId, event.value)) {
                        this.userService.localUsers.forEach(localPlayer => {
                            localPlayer.socketHandler.addCommand(OgCommand.Trip);
                            localPlayer.socketHandler.updateGameSettings(new GameSettings(undefined));
                            localPlayer.state = PlayerState.Neutral;
                        });
                    }
                });
                break;


            default:
                console.log("MISSING EVENT TYPE IMPLEMENTATION!");
        }
    }

    getMainLocalPlayer(): LocalPlayerData {
        if (this.userService.localUsers.length !== 0)
            return this.userService.localUsers.find(x => x.user.id === this.userService.getId() || x.socketHandler.socketPort === OG.mainPort) ?? this.userService.localUsers[0];
        else {
            this.userService.localUsers.push(new LocalPlayerData(this.userService.user, OG.mainPort, this.zone));
            return this.userService.localUsers[0];
        }
    }

    updateAllPlayerInfo() {
        if (!this.run) return;
        this.run.getAllPlayers().forEach(player => {
            this.userService.localUsers.forEach(localPlayer => {
                localPlayer.socketHandler.updatePlayerInfo(player.user.id, this.run!.getRemotePlayerInfo(player.user.id));
            });
        });
    }

    //used by both run component and practice/recording tool
    setupRunStart() {
        this.userService.localUsers.forEach(localPlayer => {
            localPlayer.socketHandler.resetOngoingRecordings();
            localPlayer.levelHandler.uncollectedLevelItems = new RunStateHandler();
            localPlayer.socketHandler.updateGameSettings(new GameSettings(this.run?.data));
            localPlayer.socketHandler.setAllRealPlayersMultiplayerState();
        });

        this.updateAllPlayerInfo();

        this.run?.teams.forEach(team => {
            team.runState = new RunStateHandler();
        });
        this.userService.localUsers.forEach(localPlayer => {
            localPlayer.updateTeam(this.run?.getPlayerTeam(localPlayer.user.id));
        });
    }

    async updateFirestoreLobby() {
        let localPlayer = this.getMainLocalPlayer();
        if (!this.isOnlineInstant || !this.lobby || !(this.lobby?.backupHost?.id === localPlayer.user.id || this.lobby?.host?.id === localPlayer.user.id || this.lobby?.host === null)) return;
        this.lobby.lastUpdateDate = new Date().toUTCString();
        await this.firestoreService.updateLobby(this.lobby);
    }

    private runSyncLocalPlayer(localPlayer: LocalPlayerData, run: Run, reconstructTimer: boolean) {
        if (!this.run) return;

        localPlayer.socketHandler.timer.importTimer(run.timer);
        if (reconstructTimer) this.run.reconstructTimer(localPlayer.socketHandler.timer);
        localPlayer.socketHandler.run = this.run;

        //update player and team
        localPlayer.mode = this.run.data.mode;
        let playerTeam = this.run.getPlayerTeam(localPlayer.user.id);
        if (playerTeam) { //clean out collectables so that potentially missed ones are given on import
            playerTeam.splits = [];
            localPlayer.updateTeam(playerTeam);
        }

        localPlayer.levelHandler.uncollectedLevelItems = new RunStateHandler();
        if (this.run.teams.length !== 0) {
            const importTeam: Team = playerTeam?.runState ? playerTeam : this.run.teams[0];
            localPlayer.importRunStateHandler(importTeam.runState, true);
        }
    }


    handleStateChange(localPlayer: LocalPlayerData, state: GameState) {
        this.zone.run(() => {
            if (!this.run || this.isSpectatorOrNull(localPlayer.user.id) || localPlayer.state === PlayerState.Finished) return;
            
            this.sendEvent(EventType.NewPlayerState, localPlayer.user.id, state);
            localPlayer.gameState = state;
            localPlayer.checkDesync(this.run!);
        })
    }


    destroy() {
        this.isBeingDestroyed = true;
        const mainLocalPlayer = this.getMainLocalPlayer();
        const wasHost = this.localMaster && this.isOnlineInstant && this.lobby?.host?.id === mainLocalPlayer.user.id;

        this.resetUser();
        this.lobbySubscription?.unsubscribe();
        this.userService.removeAllExtraLocals();
        this.launchListener();

        if (this.lobby && (wasHost || this.lobby?.host === null)) { //host removes user from lobby otherwise but host has to the job for himself
            if (wasHost) {
                console.log("Removing host!")
                this.lobby.host = null;
            }
            this.lobby.removeUser(mainLocalPlayer.user.id);
            this.updateFirestoreLobby();
        }
    }
}