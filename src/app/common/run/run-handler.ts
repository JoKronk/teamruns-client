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
import { OG } from "../opengoal/og";
import { LobbyUser } from "../firestore/lobby-user";
import { User, UserBase } from "../user/user";
import { FireStoreService } from "src/app/services/fire-store.service";
import { CitadelOption, RunData } from "./run-data";
import { Player } from "../player/player";
import { Category } from "./category";
import { DbRun } from "../firestore/db-run";
import { UserPositionDataTimestamp } from "../playback/position-data";
import { GameState } from "../opengoal/game-state";
import { GameTaskLevelTime } from "../opengoal/game-task";
import { Team } from "./team";
import { TaskStatus } from "../opengoal/task-status";
import { LevelHandler } from "../level/level-handler";
import { Crate } from "../level/crate";
import { InteractionType } from "../opengoal/interaction-type";
import { Orb } from "../level/orb";
import { Buzzer } from "../level/buzzer";
import { Eco } from "../level/eco";
import pkg from 'app/package.json';
import { PositionHandler } from "../playback/position-handler";
import { RunStateHandler } from "../level/run-state-handler";
import { Level } from "../opengoal/levels";

export class RunHandler {

    lobby: Lobby | undefined;
    run: Run | undefined;
    levelHandler: LevelHandler = new LevelHandler();

    connected: boolean = false;
    info: string = "";
    isBeingDestroyed: boolean = false;
    becomeHostQuickAccess: boolean;

    isOnlineInstant: boolean = false;
    localMaster: RTCPeerMaster | undefined;
    localSlave: RTCPeerSlave | undefined;

    private obsUserId: string | null;
    
    positionHandler: PositionHandler;

    dataSubscription: Subscription;
    positionSubscription: Subscription;
    lobbySubscription: Subscription;
    recordingsSubscription: Subscription;
    private launchListener: any;

    constructor(lobbyId: string | undefined,
        public firestoreService: FireStoreService,
        public userService: UserService,
        private localPlayer: LocalPlayerData,
        public zone: NgZone,
        obsUserId: string | null = null) {
        
        this.isOnlineInstant = lobbyId !== undefined;
        this.positionHandler = new PositionHandler(userService);
        this.zone = zone;
        this.obsUserId = obsUserId;

        //lobby listener
        if (this.isOnlineInstant) {
            this.lobbySubscription = this.firestoreService.getLobbyDoc(lobbyId!).snapshotChanges().subscribe(snapshot => {
                if (snapshot.payload.metadata.hasPendingWrites || this.isBeingDestroyed) return;
                let lobby = snapshot.payload.data();
                if (!lobby) return;
    
                this.lobby = Object.assign(new Lobby(lobby.runData, lobby.creatorId, lobby.password, lobby.id), lobby);
    
                //create run if it doesn't exist
                if (!this.run) {
                    this.setupRun();
                    this.positionHandler.startDrawPlayers();
                }
    
                this.onLobbyChange();
            });
        }
        //local lobby
        else {
            this.lobby = new Lobby(RunData.getFreeroamSettings(pkg.version), this.userService.getId(), null);

            //create run if it doesn't exist
            if (!this.run)
                this.setupRun();

            this.onLobbyChange();
        }


        //position listener
        if (this.userService.gameLaunched)
            this.setupSocketListener();
        this.launchListener = (window as any).electron.receive("og-launched", (launched: boolean) => {
            if (launched) 
                this.setupSocketListener();
        });
    }

    private setupSocketListener() {
        this.positionHandler.ogSocket.subscribe(target => {

            //handle position
            if (this.localPlayer.team !== undefined) {
                const positionData = new UserPositionDataTimestamp(target.position, this.run?.timer.totalMs ?? 0, this.localPlayer.user);
                this.sendPosition(positionData);
                if (this.run?.timer.runState === RunState.Started)
                    this.handlePlayerInteractions(positionData);
            }

            //handle game state changes for current player
            if (target.state)
                this.handleStateChange(target.state);

            if (target.levels)
                this.levelHandler.onLevelsUpdate(target.levels);
        });

        if (!this.recordingsSubscription) {
            this.recordingsSubscription = this.positionHandler.recordingPickups.subscribe(positionData => {
                this.handlePlayerInteractions(positionData);
            });
        }
    }


    async onLobbyChange() {
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

            if (!this.lobby.hasUser(userId))
                this.lobby.addUser(new LobbyUser(this.localPlayer.user, false));

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

    userIsNull() {
        return !this.localPlayer.user.id || this.localPlayer.user.id === "";
    }

    isSpectatorOrNull() {
        return this.userIsNull() || this.lobby?.hasSpectator(this.localPlayer.user.id);
    }

    getNewBackupHost() {
        if (!this.lobby) return;
        let candidate = this.run?.getAllPlayers().find(player => player.user.id !== this.localPlayer.user.id && player.state !== PlayerState.Disconnected) ?? this.run?.spectators.find(player => player.user.id !== this.localPlayer.user.id && !player.user.id.startsWith("OBS-") && player.state !== PlayerState.Disconnected) ?? null;
        this.lobby.backupHost = candidate ? candidate.user : null;
    }

    shouldBecomeHost(userId: string): boolean {
        if (!this.lobby || this.obsUserId) return false;
        if ((!this.lobby.host && (!this.lobby.backupHost || this.lobby.backupHost.id === this.localPlayer.user.id)) || (this.lobby.host?.id === userId && !this.localMaster))
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
        this.run = new Run(this.lobby.runData, this.positionHandler.timer);

        //setup local user (this should be done here or at some point that isn't instant to give time to load in the user if a dev refresh happens while on run page)
        if (this.isOnlineInstant) {
            this.localPlayer.user = this.userService.user.createUserBaseFromDisplayName();
            this.localPlayer.mode = this.run.data.mode;
            this.run.spectators.push(new Player(this.localPlayer.user));
        }
        else {
            setTimeout(() => { //lousy way to make sure userId has loaded in before we change team !TODO: Replace
                this.localPlayer.user = this.userService.user.createUserBaseFromDisplayName();
                this.localPlayer.mode = this.run!.data.mode;
                this.run!.spectators.push(new Player(this.localPlayer.user));

                this.sendEvent(EventType.ChangeTeam, 0);
                this.localPlayer.team = this.run?.getPlayerTeam(this.userService.getId());
            }, 1000);
        }

        //set run info
        if (this.run.data.category == 0)
            this.info = this.run.data.name + "\n\nSame Level: " + this.run.data.requireSameLevel + "\nSolo Zoomers: " + this.run.data.allowSoloHubZoomers + "\nNo LTS: " + this.run.data.noLTS + "\nCitadel Skip: " + CitadelOption[this.run.data.citadelSkip];
        else
            this.info = this.run.data.name + "\n\n" + RunMode[this.run.data.mode] + "\nCategory: " + Category.GetGategories()[this.run.data.category].displayName + "\nSame Level: " + this.run.data.requireSameLevel;
    }

    setupMaster() {
        console.log("Setting up master!");
        this.localMaster = new RTCPeerMaster(this.userService.user.createUserBaseFromDisplayName(), !this.run!.data.hideOtherPlayers, this.firestoreService.getLobbyDoc(this.lobby!.id));
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
        this.localSlave = new RTCPeerSlave(this.userService.user.createUserBaseFromDisplayName(), !this.run!.data.hideOtherPlayers, this.firestoreService.getLobbyDoc(this.lobby!.id), this.lobby!.host!);
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

    sendEvent(type: EventType, value: any = null) {
        this.sendEventCommonLogic(new DataChannelEvent(this.userService.getId(), type, value));
    }

    sendInternalEvent(type: EventType, userId: string, value: any = null) {
        this.sendEventCommonLogic(new DataChannelEvent(userId, type, value));
    }

    private sendEventCommonLogic(event: DataChannelEvent) {
        if (this.localSlave) {
            if (this.isOnlineInstant)
                this.localSlave.peer.sendEvent(event);
            this.onDataChannelEvent(event, false); //to run on a potentially safer but slower mode disable this and send back the event from master/host
        }
        else if (this.localMaster && this.lobby?.host?.id === this.localPlayer.user.id && !this.localMaster.isBeingDestroyed)
            this.onDataChannelEvent(event, true);

        else if (!this.isOnlineInstant)
            this.onDataChannelEvent(event, true);
    }


    sendPosition(positionData: UserPositionDataTimestamp) {
        if (!this.isOnlineInstant) return;

        if (this.localSlave) {
            this.localSlave.peer.sendPosition(positionData);
        }
        else if (this.localMaster && this.lobby?.host?.id === this.localPlayer.user.id && !this.localMaster.isBeingDestroyed)
            this.localMaster?.relayPositionToSlaves(positionData);
    }

    onPostionChannelUpdate(positionData: UserPositionDataTimestamp, isMaster: boolean) {
        if (!this.run) return;
        //send updates from master to all slaves
        if (isMaster && this.isOnlineInstant)
            this.localMaster?.relayPositionToSlaves(positionData);

        if (positionData.userId !== this.userService.getId()) {
            this.positionHandler.updatePlayerPosition(positionData);

        const player = this.run.getPlayer(positionData.userId);
        if (this.run?.timer.runState === RunState.Started && player && player.state !== PlayerState.Finished && player.state !== PlayerState.Forfeit)
            this.handlePlayerInteractions(positionData);
        }
    }

    handlePlayerInteractions(positionData: UserPositionDataTimestamp) {
        if (positionData.interType === InteractionType.none || !this.run) return;
        const userId = this.userService.getId();

        switch (positionData.interType) {

            case InteractionType.gameTask:
                if (!this.localPlayer.team || this.userIsNull()) break;
                
                const task: GameTaskLevelTime = GameTaskLevelTime.fromPositionData(positionData);
                const isNewTask: boolean = this.localPlayer.team.runState.isNewTaskStatus(task);
                if (positionData.userId === userId)
                {
                    //check duped cell buy
                    if (Task.isCellWithCost(task.name) && this.localPlayer.team && this.localPlayer.team.runState.hasAtleastTaskStatus(task, TaskStatus.needResolution))
                        OG.runCommand("(send-event *target* 'get-pickup 5 " + Task.cellCost(task) + ".0)");

                    if (task.name === "citadel-sage-green")
                        this.localPlayer.hasCitadelSkipAccess = false;

                    if (isNewTask && Task.isRunEnd(task)) {
                        this.zone.run(() => {
                            this.localPlayer.state = PlayerState.Finished;
                            this.sendEvent(EventType.EndPlayerRun, task);
                        });
                    }
                }

                if (!isNewTask) break;
                
                const isCell: boolean = Task.isCellCollect(task);
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
                    this.levelHandler.onNewTask(task, isCell);

                    //cell cost check
                    if (isCell && isLocalPlayerTeam && !this.run.isMode(RunMode.Lockout)) {
                        const cost = Task.cellCost(task);
                        if (cost !== 0)
                            OG.runCommand("(send-event *target* 'get-pickup 5 -" + cost + ".0)");
                    }

                    this.localPlayer.checkTaskUpdateSpecialCases(task, this.run, (this.run.data.sharedWarpGatesBetweenTeams || isLocalPlayerTeam));
                }
                
                //add to team run state
                playerTeam.runState.addTask(task);

                //handle Lockout
                if (this.run.isMode(RunMode.Lockout))
                    this.localPlayer.checkLockoutRestrictions(this.run);
                break;
        
            case InteractionType.buzzer:
                if (!this.localPlayer.team) break;

                const buzzer = Buzzer.fromPositionData(positionData);
                if (positionData.userId !== userId && this.run.getPlayerTeam(positionData.userId)?.id === this.localPlayer.team.id)
                    this.levelHandler.onBuzzerCollect(buzzer);

                this.run.getPlayerTeam(positionData.userId)?.runState.addBuzzer(buzzer);
                break;
            

            case InteractionType.money:
                if (!this.localPlayer.team) break;
                
                let teamOrbLevelState = this.localPlayer.team.runState.getCreateLevel(positionData.interLevel);
                const orb = Orb.fromPositionData(positionData);
                if (this.localPlayer.team.runState.isOrbDupe(orb, teamOrbLevelState)) {
                    if (positionData.userId === userId)
                        OG.runCommand('(remove-money-dupe-from-level "' + orb.level + '")');
                    break;
                }
                if (positionData.userId !== userId && (this.run.isMode(RunMode.Lockout) || this.run.getPlayerTeam(positionData.userId)?.id === this.localPlayer.team.id))
                    this.levelHandler.onOrbCollect(orb);
                
                this.run.getPlayerTeam(positionData.userId)?.runState.addOrb(orb, teamOrbLevelState);
                break;
        

            case InteractionType.ecoBlue:
            case InteractionType.ecoYellow:
            case InteractionType.ecoGreen:
            case InteractionType.ecoRed:
                if (!this.localPlayer.team) break;
                if (positionData.userId !== userId && (this.run.isMode(RunMode.Lockout) ||  this.run.getPlayerTeam(positionData.userId)?.id === this.localPlayer.team.id)) {
                    const index = this.positionHandler.getPlayerIngameIndex(positionData.userId);
                    if (index !== undefined) OG.runCommand("(safe-give-eco-by-target-idx " + index + " " + positionData.interType + " " + positionData.interAmount + ".0)");
                    this.levelHandler.onEcoPickup(Eco.fromPositionData(positionData));
                }
                break;


            case InteractionType.crateNormal:
            case InteractionType.crateIron:
            case InteractionType.crateSteel:
            case InteractionType.crateDarkeco:
                if (!this.localPlayer.team) break;
                const crate = Crate.fromPositionData(positionData);
                if (positionData.userId !== userId && ((this.run.isMode(RunMode.Lockout) && !Crate.isBuzzerType(crate.type)) || this.run.getPlayerTeam(positionData.userId)?.id === this.localPlayer.team.id))
                    this.levelHandler.onCrateDestroy(crate);

                if (Crate.isBuzzerType(crate.type) || Crate.isOrbsType(crate.type))
                    this.run.getPlayerTeam(positionData.userId)?.runState.addCrate(crate);
                break;


            case InteractionType.fishCaught:
            case InteractionType.fishMissed:
                if (!this.localPlayer.team) break;
                if (positionData.userId !== userId && this.levelHandler.levelIsActive(Level.jungle) && (this.run.isMode(RunMode.Lockout) || this.run.getPlayerTeam(positionData.userId)?.id === this.localPlayer.team.id))
                    OG.runCommand("(set-fish-stats " + positionData.interAmount + " " + positionData.interType + ")");
                break;

        }
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
                        this.sendEvent(EventType.Reconnect, newUser.id);
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
                else if (event.userId === this.localPlayer.user.id) {
                    this.sendEvent(EventType.RequestRunSync);
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

                //host logic
                if (isMaster) {
                    if (this.localMaster?.peers) { //yes this is needed
                        let peer = this.localMaster.peers.find(x => x.user.id === disconnectedUser.id);
                        if (peer) {
                            console.log("Destorying disconnected peer");
                            peer.peer.destroy();
                            if (peer.peer.usesServerCommunication && this.isOnlineInstant)
                                this.firestoreService.deleteLobbyServerCommunication(this.lobby.id, disconnectedUser.id);
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
                if (this.localPlayer.user.id === event.value.id && (this.lobby?.host?.id === event.userId || this.localPlayer.user.id === event.userId)) {
                    this.userService.sendNotification("You've been kicked from the lobby.");
                    this.userService.routeTo('/lobby');
                }
                else if (isMaster && event.value.id.startsWith("OBS-"))
                    this.sendEvent(EventType.Disconnect, event.value);
                break;


            case EventType.Reconnect:
                this.zone.run(() => {
                    this.run!.reconnectPlayer(event.value);
                });
                break;


            case EventType.RequestRunSync:
                if (isMaster) {
                    this.localMaster?.respondToSlave(new DataChannelEvent(userId, EventType.RunSync, this.run), event.userId);
                    console.log("Got run request, responding!");

                    //check for self kick if suspected of being tied to client to server communication as host
                    if (this.localMaster && this.localMaster.peers.length > 1 && this.localMaster.peers.every(x => x.peer.usesServerCommunication)) {
                        this.userService.sendNotification("Unfit as host, please rejoin.");
                        if (this.lobby?.backupHost === null) {
                            this.getNewBackupHost();
                            this.updateFirestoreLobby().then(() => {
                                this.userService.routeTo('/lobby');
                            });
                        }
                        else
                            this.userService.routeTo('/lobby');
                    }
                }
                break;


            case EventType.RunSync:
                this.zone.run(() => {

                    //update run
                    let run: Run = JSON.parse(JSON.stringify(event.value)); //to not cause referece so that import can run properly on the run after
                    this.run = Object.assign(new Run(run.data, this.positionHandler.timer), run).reconstructRun();
                    this.positionHandler.timer.importTimer(run.timer);
                    this.run.reconstructTimer(this.positionHandler.timer);

                    //update player and team
                    this.localPlayer.mode = this.run.data.mode;
                    let playerTeam = this.run.getPlayerTeam(this.obsUserId ? this.obsUserId : this.localPlayer.user.id);
                    if (playerTeam) {
                        //clean out collectables so that potentially missed ones are given on import
                        if (!this.obsUserId)
                            playerTeam.splits = [];

                        this.localPlayer.team = playerTeam;
                    }

                    this.levelHandler.uncollectedLevelItems = new RunStateHandler();
                    if (this.run.teams.length !== 0) {
                        const importTeam: Team = playerTeam?.runState ? playerTeam : this.run.teams[0];
                        this.levelHandler.importRunStateHandler(importTeam.runState, this.localPlayer, importTeam.players.length !== 0 ? importTeam.players[0].gameState.currentCheckpoint : "game-start");
                    }
                    this.run.updateSelfRestrictions(this.localPlayer);

                    this.connected = true;
                });
                break;



            case EventType.EndPlayerRun:
                this.zone.run(() => {
                    if (Task.isRunEnd(event.value))
                        this.run!.addSplit(new Task(event.value));

                    this.run?.endPlayerRun(event.userId, event.value.name === Task.forfeit);
                    this.run?.isMode(RunMode.Lockout) ? this.run.endAllTeamsRun(event.value) : this.run?.endTeamRun(event.value);

                    if (isMaster && this.isOnlineInstant && this.run?.timer.runState === RunState.Ended && !this.run.teams.every(x => x.hasUsedDebugMode) && !this.run.teams.flatMap(x => x.players).every(x => x.state === PlayerState.Forfeit)) {
                        let run: DbRun = DbRun.convertToFromRun(this.run);
                        this.firestoreService.addRun(run); //history
                        run.checkUploadPbs(this.firestoreService); //pb & leadeboard
                    }
                });
                break;

            case EventType.NewPlayerState:
                this.zone.run(() => {
                    this.run!.updateState(event.userId, event.value, this.userService);
                });

                this.run.updateSelfRestrictions(this.localPlayer);
                if (event.userId !== userId)
                    this.localPlayer.checkForZoomerTalkSkip(event.value);
                break;

            case EventType.ChangeTeam:
                this.zone.run(() => {
                    const user = this.getUser(event.userId)?.user;
                    this.run?.changeTeam(user, event.value);
                    //check set team for obs window, set from run component if normal user
                    if ( this.obsUserId && this.obsUserId === event.userId) {
                        this.localPlayer.team = this.run?.getPlayerTeam(this.obsUserId);
                    }
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
                let team = this.run.getPlayerTeam(event.userId);
                if (!team) return;
                this.zone.run(() => {
                    team!.name = event.value;
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

                    this.sendEvent(EventType.StartRun, new Date().toUTCString());
                }
                break;


            case EventType.StartRun:
                this.zone.run(() => {
                    this.run!.start(new Date());
                });
                this.setupRunStart();
                break;


            case EventType.ToggleReset:
                this.zone.run(() => {
                    if (this.run!.toggleVoteReset(event.userId, event.value)) {
                        OG.runCommand("(send-event *target* 'loading)");
                        this.localPlayer.state = PlayerState.Neutral;
                    }
                });
                break;


            default:
                console.log("MISSING EVENT TYPE IMPLEMENTATION!");
        }
    }

    //used by both run component and practice/recording tool
    setupRunStart() {
        this.positionHandler.resetOngoingRecordings();
        this.levelHandler.uncollectedLevelItems = new RunStateHandler();

        this.run?.teams.forEach(team => {
            team.runState = new RunStateHandler();
        });

        //!TODO: could be done in some more elegant way
        setTimeout(() => {
            this.localPlayer.resetRunDependentProperties();
        }, this.run!.timer.countdownSeconds * 1000);
    }

    async updateFirestoreLobby() {
        if (!this.isOnlineInstant || !this.lobby || !(this.lobby?.backupHost?.id === this.localPlayer.user.id || this.lobby?.host?.id === this.localPlayer.user.id || this.lobby?.host === null)) return;
        this.lobby.lastUpdateDate = new Date().toUTCString();
        await this.firestoreService.updateLobby(this.lobby);
    }


    handleStateChange(state: GameState) {
        this.zone.run(() => {
            if (!this.run || this.isSpectatorOrNull() || this.localPlayer.state === PlayerState.Finished) return;

            if (this.localPlayer.gameState.cellCount !== state.cellCount)
                this.localPlayer.checkDesync(this.run);

            //this check is purely to save unnecessary writes to db if user is on client-server communication
            if (this.shouldSendStateUpdate(state))
                this.sendEvent(EventType.NewPlayerState, state);


            this.localPlayer.gameState = state;

            //handle citadel elevator
            if (this.localPlayer.gameState.justSpawned)
                this.localPlayer.checkCitadelElevator();

            //handle klaww kill
            this.localPlayer.checkKillKlaww();

            //handle no LTS
            if (this.run.data.noLTS)
                this.localPlayer.checkNoLTS();

            //handle Citadel Skip
            this.localPlayer.checkCitadelSkip(this.run);

            //check adjust player spawn point on countdown
            if (state.justSpawned && this.positionHandler.timer.runState === RunState.Countdown) {
                let playerId: number = this.run.teams.flatMap(team => team.players.flatMap(x => x.user.id)).indexOf(this.localPlayer.user.id);
                OG.runCommand("(+! (-> *target* root trans x) (meters " + playerId * 3 + ".0))");
                this.positionHandler.timer.onPlayerLoad();
            }
        })
    }

    private shouldSendStateUpdate(newState: GameState) {
        return !((this.localSlave?.peer.usesServerCommunication || !this.isOnlineInstant || this.localMaster?.peers.every(x => x.peer.usesServerCommunication)) ?? false) || GameState.hasSignificantPlayerStateChange(this.localPlayer.gameState, newState);
    }


    destroy() {
        this.isBeingDestroyed = true;
        const wasHost = this.localMaster && this.isOnlineInstant && this.lobby?.host?.id === this.localPlayer.user.id;

        this.resetUser();
        this.lobbySubscription?.unsubscribe();
        this.recordingsSubscription?.unsubscribe();
        this.positionHandler.onDestroy();
        this.launchListener();

        if (this.lobby && (wasHost || this.lobby?.host === null)) { //host removes user from lobby otherwise but host has to the job for himself
            if (wasHost) {
                console.log("Removing host!")
                this.lobby.host = null;
            }
            this.lobby.removeUser(this.localPlayer.user.id);
            this.updateFirestoreLobby();
        }
    }
}