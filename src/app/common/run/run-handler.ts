import { Run } from "./run";
import { RunMod, RunMode } from "./run-mode";
import { LocalPlayerData } from "../user/local-player-data";
import { Lobby } from "../firestore/lobby";
import { UserService } from "src/app/services/user.service";
import { BehaviorSubject, Subscription } from "rxjs";
import { DataChannelEvent } from "../peer/data-channel-event";
import { EventType } from "../peer/event-type";
import { PlayerState } from "../player/player-state";
import { NgZone } from "@angular/core";
import { Task } from "../opengoal/task";
import { LobbyUser } from "../firestore/lobby-user";
import { UserBase } from "../user/user";
import { FireStoreService } from "src/app/services/fire-store.service";
import { RunData } from "./run-data";
import { Player } from "../player/player";
import { Category, CategoryOption } from "./category";
import { DbRun } from "../firestore/db-run";
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
import { RunSetupState } from "./run-setup-state";
import { RunState } from "./run-state";
import { PbTeamPlayers } from "../peer/pb-team-players";
import { PlayerBase } from "../player/player-base";
import { PlayerType } from "../player/player-type";
import { ConnectionHandler } from "../peer/connection-handler";
import { DbUsersCollection } from "../firestore/db-users-collection";

export class RunHandler {

    lobby: Lobby | undefined;
    run: Run | undefined;
    selfImportedRecordings: UserBase[] = [];

    connected: boolean = false;
    info: string = "";
    isBeingDestroyed: boolean = false;
    becomeHostQuickAccess: boolean;

    connectionHandler: ConnectionHandler;

    lobbySubscription: Subscription;
    userSetupSubscription: Subscription;
    dataChannelSubscription: Subscription;
    pbSubscription: Subscription;
    runSetupSubject: BehaviorSubject<RunSetupState | null> = new BehaviorSubject<RunSetupState | null>(null);

    
    constructor(lobbyId: string | undefined,
        public firestoreService: FireStoreService,
        public userService: UserService,
        public dialog: MatDialog,
        public zone: NgZone,
        public isPracticeTool: boolean = false) {
            
        this.zone = zone;
        this.connectionHandler = new ConnectionHandler(this.userService.localUsers, this.userService.user, lobbyId !== undefined);
        
        this.userSetupSubscription = this.userService.userSetupSubject.subscribe(user => {
            if (!user) return;


            //lobby listener
            let userId = this.userService.getMainUserId();
            if (this.connectionHandler.isOnlineInstant) {
                this.lobbySubscription = this.firestoreService.getLobbyDoc(lobbyId!).snapshotChanges().subscribe(snapshot => {
                    if (snapshot.payload.metadata.hasPendingWrites || this.isBeingDestroyed) return;
                    let lobby = snapshot.payload.data();
                    if (!lobby) return;

                    this.lobby = Object.assign(new Lobby(lobby.runData, lobby.creatorId, lobby.password, lobby.id), lobby);
                    this.connectionHandler.onLobbyUpdate(this.lobby);

                    this.checkSetupRun();
                });
            }
            //local lobby
            else {
                this.lobby = new Lobby(this.userService.offlineSettings ?? RunData.getFreeroamSettings(pkg.version, false), userId, null);
                this.userService.offlineSettings = undefined;
                this.connectionHandler.onLobbyUpdate(this.lobby);
                this.checkSetupRun();
            }
        });

        this.dataChannelSubscription = this.connectionHandler.dataChannelEventSubject.subscribe(event => {
            this.onDataChannelEvent(event);
        });
    }

    private checkSetupRun() {
        if (!this.run)
            this.setupRun();

        this.onLobbyChange();
    }

    private markConnected() {
        if (this.connected)
            return;
        this.connected = true;
        this.runSetupSubject.next(RunSetupState.Connected);
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
            if (this.connectionHandler.isOnlineInstant)
                await this.firestoreService.deleteLobbySubCollections(this.lobby.id);

            if (this.connectionHandler.isSlave())
                this.run?.removePlayer(this.connectionHandler.getHostId());

            this.resetUser();
            this.lobby.host = this.userService.user.generatePlayerBase();

            if (this.lobby.backupHost?.id === userId) //replace backup host if user was backup, host is kicked out of user list and lobby host role by backupHost on data channel disconnect
                this.getNewBackupHost();

            this.userService.localUsers.forEach(localPlayer => {
                if (this.lobby && !this.lobby.hasUser(userId))
                    this.lobby.addUser(new LobbyUser(localPlayer.user.generatePlayerBase(), false));
            });

            this.lobby.users = this.lobby.users.filter(x => x.isRunner || this.run?.hasSpectator(x.user.id));

            if (this.connectionHandler.isOnlineInstant) {
                this.lobby.visible = true;
                await this.updateFirestoreLobby();
                this.connectionHandler.setupMaster(this.firestoreService.getLobbyDoc(this.lobby!.id));
            }
            this.markConnected();
        }


        //slave checks on lobby change
        if (this.connectionHandler.isOnlineInstant && !this.connectionHandler.isMaster()) {
            //kill current slave connection if new host
            if (this.connectionHandler.getHostId() !== this.lobby.host?.user.id)
                this.resetUser();

            //become slave if not already and master exists
            if (!this.connectionHandler.isSlave() && this.lobby.host)
                this.connectionHandler.setupSlave(this.firestoreService.getLobbyDoc(this.lobby!.id));
        }
    }

    setupLocalMainPlayer(localMain: LocalPlayerData) {
        if (!this.run) return;

        this.userService.resetLocalPlayersToNewMain(localMain);
        this.connectionHandler.reLinkLocalPeers(this.userService.localUsers);

        this.run.spectators.push(new Player(localMain.user.getUserBaseWithDisplayName(), localMain.user.getPlayerType()));
        localMain.socketHandler.startDrawPlayers();

        if (!this.connectionHandler.isOnlineInstant) {
          this.onLobbyChange();
          if (this.isPracticeTool) {
            this.connectionHandler.sendEvent(EventType.ChangeTeam, localMain.user.id, 0);
            localMain.updateTeam(this.run.getPlayerTeam(localMain.user.id));
          }
        }
    }

    setupLocalSecondaryPlayer(localPlayer: LocalPlayerData, teamId: number) {
        if (!this.run) return;

        this.run.spectators.push(new Player(localPlayer.user.getUserBaseWithDisplayName(), localPlayer.user.getPlayerType()));
        this.connectionHandler.sendEvent(EventType.Connect, localPlayer.user.id, localPlayer.user.generatePlayerBase());
        this.connectionHandler.sendEvent(EventType.ChangeTeam, localPlayer.user.id, teamId);
        localPlayer.updateTeam(this.run.getPlayerTeam(localPlayer.user.id));

        localPlayer.socketHandler.run = this.run;
        localPlayer.socketHandler.startDrawPlayers();
    }

    resetUser() {
        this.connectionHandler.destory();
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
        if ((!this.lobby.host && (!this.lobby.backupHost || this.lobby.backupHost.id === this.userService.getMainUserId())) || (this.lobby.host?.user.id === userId && !this.connectionHandler.isMaster()))
            return true;
        else
            return false;
    }

    dehost() { //used only for testing atm, cannot currently be used if host is in a team as he's removed from the team on dehost
        if (!this.connectionHandler.isMaster() || !this.lobby) return;
        console.log("dehosting");
        this.connectionHandler.destory();
        this.lobby.host = null;
        this.getNewBackupHost();
        this.updateFirestoreLobby();
    }


    setupRun() {
        if (!this.lobby) return;

        console.log("Creating Run!");
        this.run = new Run(this.lobby.runData, this.isPracticeTool);

        this.runSetupSubject.next(RunSetupState.SetupComplete);

        //set run info
        if (this.run.isMode(RunMode.Speedrun)) {
            if (this.run.data.sameLevel)
                this.info = Category.GetGategories()[this.run.data.category].displayName + " (Same Level)";
            else
                this.info = Category.GetGategories()[this.run.data.category].displayName;
        }
        else
            this.info = RunMode[this.run.data.mode];
    }

    onDataChannelEvent(event: DataChannelEvent) {
        if (!this.run) return;
        const userId = this.userService.getMainUserId();

        //send updates from master to all slaves | this should be here and not moved up to sendEvent as it's not the only method triggering this
        if (this.connectionHandler.isMaster() && this.connectionHandler.isOnlineInstant && event.type !== EventType.RequestRunSync && event.type !== EventType.RunSync)
            this.connectionHandler.relayToSlaves(event);

        switch (event.type) {

            case EventType.Connect: //rtc stuff on connection is setup individually in rtc-peer-master/slave
                const newUser: PlayerBase = event.value as PlayerBase;
                console.log(newUser.user.name + " connected!");

                if (this.connectionHandler.isMaster()) {
                    //handle run
                    const isRunner: boolean = (this.run.getPlayerTeam(newUser.user.id) !== undefined);
                    if (isRunner)
                        this.connectionHandler.sendEventAsMain(EventType.Reconnect, newUser.user.id);
                    else if (!this.run.hasSpectator(newUser.user.id))
                        this.run!.spectators.push(new Player(newUser.user, newUser.type));

                    //handle lobby
                    if (!this.lobby?.hasUser(newUser.user.id)) {
                        this.lobby?.addUser(new LobbyUser(newUser, isRunner));
                        this.updateFirestoreLobby();
                    }
                    else if ((this.lobby.hasRunner(newUser.user.id) && !isRunner) || (this.lobby.hasSpectator(newUser.user.id) && isRunner)) {
                        this.lobby!.getUser(newUser.user.id)!.isRunner = isRunner;
                        this.updateFirestoreLobby();
                    }

                    if (this.connectionHandler.isPotentialTurnServerHost())
                        this.userService.sendNotification("Potential TURN restriction detected for host, swapping lobby host recommended.", 20000);
                }
                else if (event.userId === userId) {
                    this.connectionHandler.sendEventAsMain(EventType.RequestRunSync, new SyncRequest(userId, SyncRequestReason.InitConnect));
                }
                else if (!this.run.hasSpectator(newUser.user.id) && !this.userService.localUsers.some(x => x.user.id === newUser.user.id))
                    this.run!.spectators.push(new Player(newUser.user, newUser.type));

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
                if (this.connectionHandler.isMaster()) {
                    this.connectionHandler.destoryPeer(disconnectedUser.id);

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
                else if (event.value === this.lobby.host?.user.id && this.lobby.backupHost?.id === userId) {
                    this.lobby.host = null; //current user will pickup host role on the file change
                    this.updateFirestoreLobby();
                }
                break;


            case EventType.Kick:
                if (userId === event.value.id && (this.lobby?.host?.user.id === event.userId || userId === event.userId)) {
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
                        this.connectionHandler.sendEvent(EventType.Disconnect, event.value.id, event.value);
                    }
                    
                    if (this.selfImportedRecordings.some(x => x.id === event.value.id))
                        this.connectionHandler.sendEvent(EventType.Disconnect, event.value.id, event.value);
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
                if (this.connectionHandler.isMaster()) {
                    this.connectionHandler.respondToSlave(new DataChannelEvent(userId, EventType.RunSync, new SyncResponse(event.value, this.run)), event.userId);
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
                    this.markConnected();
                });
                break;



            case EventType.EndPlayerRun:
                this.zone.run(() => {
                    if (!this.run) return;
                    const endTask: GameTaskLevelTime = event.value;
                    this.run.addSplit(new Task(endTask));

                    this.run.endPlayerRun(event.userId, endTask.name === Task.forfeit);
                    RunMod.endRunOnSiglePlayerFinish(this.run.data.mode) ? this.run.endAllTeamsRun(endTask) : this.run?.checkSetTeamEndTime(endTask);
                    
                    let playerTeam = this.run.getPlayerTeam(userId);
                    if (!playerTeam || !this.run.everyoneHasFinished(playerTeam))
                        return;

                    let recordings: UserRecording[] | undefined = this.getMainLocalPlayer()?.socketHandler.resetGetRecordings();
                    this.checkSaveRecordingsLocally(recordings, playerTeam);

                    
                    const players: Player[] = this.run.getAllPlayers();
                    this.firestoreService.getUsers().then(collection => {
                        if (!collection || !players || !playerTeam || !this.run) return;
                        let signedInPlayers: string[] = players.filter(player => collection.users.some(user => user.id === player.user.id)).flatMap(x => x.user.id);
                    
                        //run validation
                        this.checkTeamGameVersions(playerTeam); //!TODO: Should be check earlier than run end.
                        this.run.checkRunEndValid();
                        this.validateTeamPlayersSignedIn(collection);
                        if (!playerTeam.runIsValid && playerTeam.runInvalidReason) 
                            this.userService.sendNotification(playerTeam.runInvalidReason.startsWith("Run invalid") ? playerTeam.runInvalidReason : ("Run Invalid: " + playerTeam.runInvalidReason), 10000);

                        //pb upload
                        if (this.connectionHandler.isMaster() && RunMod.isAddedToRunHistory(this.run.data.mode) && !this.isPracticeTool && this.run.everyoneHasFinished()) {
                            let dbRun: DbRun = DbRun.convertToFromRun(this.run, this.lobby);
                        
                            // add run to history if any player is signed in
                            if (players.some(player => collection.users.find(user => user.id === player.user.id)))
                                this.firestoreService.addRun(dbRun);
                            
                            // add pb
                            if (this.run?.data.submitPbs && this.run.isMode(RunMode.Speedrun) && this.run.teams.some(x => x.runIsValid)) {
                                const pbUploadSubscription = dbRun.checkUploadPbs(this.firestoreService, signedInPlayers, recordings)?.subscribe(pbUsers => {
                                    pbUploadSubscription?.unsubscribe();
                                    if (pbUsers.length !== 0) {
                                        setTimeout(() => { //give some time for pb to upload !TODO: replace with proper pipe
                                            this.connectionHandler.sendEventAsMain(EventType.NewPb, pbUsers);
                                        }, 1000);
                                    }
                                });
                            }
                        }
                    });
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
                                //send in game notification
                                for (let player of this.userService.localUsers) {
                                    if (pbTeam.playerIds.includes(player.user.id))
                                        player.socketHandler.sendNotification(pbTeam.leaderboardPosition === 0 ? "New World Record!" : "New PB! " + DbPb.placementNumberToString(pbTeam.leaderboardPosition) + " place.", 10);
                                }

                                //open pb dialog
                                const dialogSubscription = this.dialog.open(PbCommentDialogComponent, { data: { newPb: true } }).afterClosed().subscribe((content: DbRunUserContent) => {
                                    dialogSubscription.unsubscribe();
                                    this.pbSubscription.unsubscribe();
                                    if (content) {
                                        content.userId = userId;
                                        currentPbData = Object.assign(new DbPb(), currentPbData);
                                        currentPbData.userContent = currentPbData.userContent.filter(x => x.userId !== content.userId);
                                        currentPbData.userContent.push(content);
                                        this.firestoreService.updatePb(currentPbData);
                                    }
                                });
                            }
                        });
                    }
                }
                break;
                
            case EventType.NewPlayerState:
                this.zone.run(() => {
                    if (!this.run) return;
                    let player = this.run.getPlayer(event.userId);
                    let state: GameState = event.value;
                    if (!player) return;

                    if (!player.gameState.debugModeActive && state.debugModeActive && this.run.timer.inRunPastCountdown()) {
                        let notifMessage = player.user.name + " just activated debug mode!";
                        this.userService.sendNotification(notifMessage);
                        for (let localPlayer of this.userService.localUsers)
                            localPlayer.socketHandler.sendNotification(notifMessage, 5);
                    }

                    this.run!.updateState(event.userId, state, player);
                });
                break;

            case EventType.ChangeTeam:
                this.zone.run(() => {
                    const user = this.run?.getPlayer(event.userId)?.user;
                    this.run?.changeTeam(user, event.value);
                    this.updateAllPlayerInfo();
                });

                if (!this.connectionHandler.isMaster()) break;
                const user: LobbyUser | undefined = this.lobby?.getUser(event.userId);
                if (!user || user.isRunner) break;

                user.isRunner = true;
                if (!this.lobby!.runnerIds.includes(user.user.id))
                    this.lobby!.runnerIds.push(user.user.id);
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
                        this.connectionHandler.sendEvent(EventType.Ready, localPlayer.user.id, event.value);
                    }
                    this.selfImportedRecordings.forEach(recPlayer => {
                        this.connectionHandler.sendEvent(EventType.Ready, recPlayer.id, event.value);
                    });
                }
                
                this.zone.run(() => {
                    this.run!.toggleReady(event.userId, event.value);
                });

                //check if everyone is ready, send start call if so
                if (this.connectionHandler.isMaster() && event.value === PlayerState.Ready && this.run!.everyoneIsReady()) {
                    if (this.run.data.mode !== RunMode.Casual)
                        this.makeLobbyUnavailable();

                    this.connectionHandler.sendEventAsMain(EventType.StartRun, new Date().toUTCString());
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
                        this.connectionHandler.sendEvent(EventType.ToggleReset, localPlayer.user.id, event.value);
                    }
                    this.selfImportedRecordings.forEach(recPlayer => {
                        this.connectionHandler.sendEvent(EventType.ToggleReset, recPlayer.id, event.value);
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
                        this.makeLobbyAvailable();
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

    validateTeamPlayersSignedIn(userCollection: DbUsersCollection | undefined = undefined) {
        if (!this.run || !this.lobby) return;
        let userIds: string[] | undefined = userCollection === undefined ? undefined : userCollection.users.flatMap(x => x.id);

        for (let team of this.run.teams) {
            if (!team.runIsValid)
                continue;

            for (let player of team.players) {
                let lobbyPlayer = this.lobby.users.find(x => x.user.id === player.user.id);
                if ((userIds && !userIds.includes(player.user.id)) || (lobbyPlayer && lobbyPlayer.type !== PlayerType.User)) {
                    team.checkMarkRunInvalid(false, "Run invalid for leaderboard, includes Guest User(s).");
                    break;
                }
            }
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
        this.validateTeamPlayersSignedIn();

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
                    const pbSubscription = this.firestoreService.getUsersCurrentPb(this.run.data.category, playerIds.length === 1 ? false : this.run.data.sameLevel, playerIds).subscribe(pbs => {
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

    makeLobbyAvailable() {
        if (!this.lobby || (this.lobby.available && this.lobby.visible))
            return;

        this.lobby.visible = true;
        this.lobby.available = true;
        this.updateFirestoreLobby();
    }

    makeLobbyUnavailable() {
        if (!this.lobby || !this.lobby.available)
            return;

        this.lobby.available = false;
        this.updateFirestoreLobby();
    }

    async updateFirestoreLobby() {
        let userId = this.userService.getMainUserId();
        if (!this.connectionHandler.isOnlineInstant || !this.lobby || !(this.lobby?.backupHost?.id === userId || this.lobby?.host?.user.id === userId || this.lobby?.host === null)) return;
        this.lobby.lastUpdateDate = new Date().toUTCString();
        await this.firestoreService.updateLobby(this.lobby);
    }

    importRecordings(recordingPackage: RecordingPackage) {
        let mainLocalPlayer = this.getMainLocalPlayer();
        for (let recording of recordingPackage.recordings) {
          const recUser = Recording.getUserBase(recording);
          this.selfImportedRecordings.push(recUser);
          this.connectionHandler.sendEvent(EventType.Connect, recUser.id, new PlayerBase(recUser, PlayerType.Recording));
          this.connectionHandler.sendEvent(EventType.ChangeTeam, recUser.id, recordingPackage.teamId);

          let forceState: boolean = recordingPackage.forceState !== undefined;
          if (mainLocalPlayer)
            mainLocalPlayer.socketHandler.addRecording(recording, forceState ? recordingPackage.forceState! : mainLocalPlayer.socketHandler.localTeam?.id === recordingPackage.teamId ? MultiplayerState.interactive : MultiplayerState.active, forceState);
        }
    }

    removeAllSelfRecordings() {
        this.selfImportedRecordings.forEach(recUser => {
              this.connectionHandler.sendEvent(EventType.Disconnect, recUser.id, recUser);
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

        localPlayer.socketHandler.cleanupHandler.resetHandler();
    }

    isHost(): boolean {
        return !this.connectionHandler.isOnlineInstant || (this.connectionHandler.isMaster() && this.lobby?.host?.user.id === this.userService.getMainUserId());
    }


    destroy() {
        this.isBeingDestroyed = true;
        const userId = this.userService.getMainUserId();
        const wasHost: boolean = this.isHost() && this.connectionHandler.isOnlineInstant;

        //disconnect recordings
        this.removeAllSelfRecordings();

        //disconnect local users
        this.userService.localUsers.forEach(localPlayer => {
            if (localPlayer.user.id !== userId)
                this.connectionHandler.sendEvent(EventType.Disconnect, localPlayer.user.id, localPlayer.user.getUserBase());
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
        this.dataChannelSubscription?.unsubscribe();
        this.pbSubscription?.unsubscribe();

        //remove demote if host
        if (this.lobby && (wasHost || this.lobby?.host === null)) { //host removes user from lobby otherwise but host has to the job for himself
            if (wasHost) {
                console.log("Removing host!")
                this.lobby.host = null;
                this.lobby.visible = false;
            }

            this.userService.localUsers.forEach(localPlayer => {
                this.lobby!.removeUser(localPlayer.user.id);
            });

            this.updateFirestoreLobby();
        }

        this.userService.removeAllExtraLocals();
    }
}