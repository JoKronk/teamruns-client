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
import { CitadelOption } from "./run-data";
import { Player } from "../player/player";
import { Category } from "./category";
import { DbRun } from "../firestore/db-run";
import { UserPositionDataTimestamp } from "../playback/position-data";
import { PositionService } from "src/app/services/position.service";
import { GameState } from "../opengoal/game-state";
import { GameTask } from "../opengoal/game-task";
import { Team } from "./team";
import { TaskStatus } from "../opengoal/task-status";
import { LevelHandler } from "../level/level-handler";
import { Crate } from "../level/crate";

export class RunHandler {

    lobby: Lobby | undefined;
    run: Run | undefined;
    levelHandler: LevelHandler = new LevelHandler();

    connected: boolean = false;
    info: string = "";
    isBeingDestroyed: boolean = false;
    becomeHostQuickAccess: boolean;

    localMaster: RTCPeerMaster | undefined;
    localSlave: RTCPeerSlave | undefined;

    userService: UserService;
    private obsUserId: string | null;

    dataSubscription: Subscription;
    positionSubscription: Subscription;
    lobbySubscription: Subscription;
    private launchListener: any;

    constructor(lobbyId: string,
        public firestoreService: FireStoreService,
        public positionHandler: PositionService,
        private localPlayer: LocalPlayerData,
        public zone: NgZone,
        obsUserId: string | null = null) {

        this.userService = positionHandler.userService;
        this.zone = zone;
        this.obsUserId = obsUserId;

        //lobby listener
        this.lobbySubscription = this.firestoreService.getLobbyDoc(lobbyId).snapshotChanges().subscribe(snapshot => {
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

        //position listener
        if (this.userService.gameLaunched)
            this.setupSocketListener();
        this.launchListener = (window as any).electron.receive("og-launched", (launched: boolean) => {
            if (launched) this.setupSocketListener();
        });
    }

    private setupSocketListener() {
        this.positionHandler.ogSocket.subscribe(target => {

            //handle position
            if (this.localPlayer.team !== undefined)
                this.sendPosition(new UserPositionDataTimestamp(target.position, this.run?.timer.totalMs ?? 0, this.localPlayer.user));

            //task updates
            if (target.task)
                this.handleTaskUpdate(target.task);

            //handle game state changes for current player
            if (target.state)
                this.handleStateChange(target.state);

            if (target.buzzer)
                this.sendEvent(EventType.NewScoutflyCollected, target.buzzer);

            if (target.orb)
                this.sendEvent(EventType.NewOrbCollected, target.orb);

            if (target.crate)
                this.sendEvent(EventType.NewCrateDestoryed, target.crate);

            if (target.levels)
                this.levelHandler.onLevelsUpdate(target.levels);
        });
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

            await this.updateFirestoreLobby();
            this.setupMaster();
            this.connected = true;
        }


        //slave checks on lobby change
        if (!this.localMaster) {
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

    isSpectatorOrNull() {
        return !this.localPlayer.user.id || this.localPlayer.user.id === "" || this.lobby?.hasSpectator(this.localPlayer.user.id);
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
        this.localPlayer.user = this.userService.user.createUserBaseFromDisplayName();
        this.localPlayer.mode = this.run.data.mode;
        this.run.spectators.push(new Player(this.localPlayer.user));

        //set run info
        if (this.run.data.category == 0)
            this.info = this.run.data.name + "\n\nSame Level: " + this.run.data.requireSameLevel + "\nSolo Zoomers: " + this.run.data.allowSoloHubZoomers + "\nNormal Cell Cost: " + this.run.data.normalCellCost + "\nNo LTS: " + this.run.data.noLTS + "\nCitadel Skip: " + CitadelOption[this.run.data.citadelSkip];
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
        const event = new DataChannelEvent(this.userService.getId(), type, value);
        if (this.localSlave) {
            this.localSlave.peer.sendEvent(event);
            this.onDataChannelEvent(event, false); //to run on a potentially safer but slower mode disable this and send back the event from master/host
        }
        else if (this.localMaster && this.lobby?.host?.id === this.localPlayer.user.id && !this.localMaster.isBeingDestroyed)
            this.onDataChannelEvent(event, true);
    }

    sendPosition(target: UserPositionDataTimestamp) {
        if (this.localSlave) {
            this.localSlave.peer.sendPosition(target);
        }
        else if (this.localMaster && this.lobby?.host?.id === this.localPlayer.user.id && !this.localMaster.isBeingDestroyed)
            this.localMaster?.relayPositionToSlaves(target);
    }

    onPostionChannelUpdate(target: UserPositionDataTimestamp, isMaster: boolean) {
        //send updates from master to all slaves
        if (isMaster)
            this.localMaster?.relayPositionToSlaves(target);

        if (target.userId !== this.userService.getId())
            this.positionHandler.updatePlayerPosition(target);
    }

    onDataChannelEvent(event: DataChannelEvent, isMaster: boolean) {
        if (!this.run) return;
        const userId = this.userService.getId();

        //send updates from master to all slaves | this should be here and not moved up to sendEvent as it's not the only method triggering this
        if (isMaster && event.type !== EventType.RequestRunSync && event.type !== EventType.RunSync)
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
                            if (peer.peer.usesServerCommunication)
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
                            playerTeam.tasks = [];

                        this.localPlayer.team = playerTeam;
                    }

                    this.run!.importTaskChanges(this.localPlayer, event.value);
                    this.connected = true;
                });
                break;



            case EventType.EndPlayerRun:
                this.zone.run(() => {
                    this.run?.endPlayerRun(event.userId, event.value.name === Task.forfeit);
                    this.run?.isMode(RunMode.Lockout) ? this.run.endAllTeamsRun(event.value) : this.run?.endTeamRun(event.value);

                    if (isMaster && this.run?.timer.runState === RunState.Ended && !this.run.teams.every(x => x.hasUsedDebugMode) && !this.run.teams.flatMap(x => x.players).every(x => x.state === PlayerState.Forfeit)) {
                        let run: DbRun = DbRun.convertToFromRun(this.run);
                        this.firestoreService.addRun(run); //history
                        run.checkUploadPbs(this.firestoreService); //pb & leadeboard
                    }
                });
                break;


            case EventType.NewTaskUpdate:
                const task: GameTask = event.value;

                if (Task.isSplit(task)) {
                    this.zone.run(() => {
                        this.run!.addSplit(new Task(task));
                    });
                }
                if (Task.isCellCollect(task))
                    this.levelHandler.onNewCell(task);

                const playerTeam = this.run.getPlayerTeam(event.userId);
                if (!playerTeam) return;
                const isLocalPlayerTeam = playerTeam.id === this.localPlayer.team?.id;

                //task updates
                if (isLocalPlayerTeam)
                    this.localPlayer.onExternalTaskUpdate(task, false)
                else if (this.run.data.sharedWarpGatesBetweenTeams)
                    this.localPlayer.onExternalTaskUpdate(task, true)


                //handle none current user things
                if (event.userId !== userId) {
                    if (playerTeam.isNewTaskUpdateAdd(task))
                        this.run.checUpdateTaskForUser(task, userId);

                    if (this.run.isMode(RunMode.Lockout) || isLocalPlayerTeam) {
                        //handle klaww kill
                        if (task.name === "ogre-boss" && task.status === TaskStatus.needReminder) {
                            this.localPlayer.killKlawwOnSpot = true;
                            this.localPlayer.checkKillKlaww();
                        }
                        //handle citadel elevator cell cases
                        else if (task.name === "citadel-sage-green" && task.status === TaskStatus.needResolution) {
                            this.localPlayer.checkCitadelSkip(this.run);
                            this.localPlayer.checkCitadelElevator();
                        }
                    }
                }

                //handle Lockout
                if (this.run.isMode(RunMode.Lockout))
                    this.localPlayer.checkLockoutRestrictions(this.run);

                break;


            case EventType.NewPlayerState:
                this.zone.run(() => {
                    this.run!.updateState(event.userId, event.value, this.userService);
                });

                this.run.updateSelfRestrictions(this.localPlayer);
                if (event.userId !== userId)
                    this.localPlayer.checkForZoomerTalkSkip(event.value);
                break;
            
            case EventType.NewScoutflyCollected:
                if (event.userId !== userId && this.run.getPlayerTeam(event.userId)?.id === this.localPlayer.team?.id)
                    this.levelHandler.onBuzzerCollect(event.value);
                break;
            
            case EventType.NewOrbCollected:
                if (event.userId !== userId && (this.run.isMode(RunMode.Lockout) ||  this.run.getPlayerTeam(event.userId)?.id === this.localPlayer.team?.id))
                    this.levelHandler.onOrbCollect(event.value);
                break;
            
            case EventType.NewCrateDestoryed:
                if (event.userId !== userId && ((this.run.isMode(RunMode.Lockout) && event.value.typ === Crate.typeWithOrbs) ||  this.run.getPlayerTeam(event.userId)?.id === this.localPlayer.team?.id))
                    this.levelHandler.onCrateDestroy(event.value);
                break;


            case EventType.ChangeTeam:
                this.zone.run(() => {
                    const user = this.getUser(event.userId)?.user;
                    this.run?.changeTeam(user, event.value);

                    //check set team for obs window, set from run component if normal user
                    if (this.obsUserId && this.obsUserId === event.userId) {
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
                    this.run!.setOrbCosts(this.localPlayer.user.id);
                });
                //!TODO: could be done in some more elegant way
                setTimeout(() => {
                    this.localPlayer.resetRunDependentProperties();
                }, this.run!.timer.countdownSeconds * 1000);
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

    async updateFirestoreLobby() {
        if (!this.lobby || !(this.lobby?.backupHost?.id === this.localPlayer.user.id || this.lobby?.host?.id === this.localPlayer.user.id || this.lobby?.host === null)) return;
        this.lobby.lastUpdateDate = new Date().toUTCString();
        await this.firestoreService.updateLobby(this.lobby);
    }


    handleTaskUpdate(task: GameTask) {
        this.zone.run(() => {
            if (!this.run || this.isSpectatorOrNull()) return;

            //check duped cell buy
            if (Task.isCellWithCost(task.name) && this.localPlayer.team && this.localPlayer.team.tasksStatus.has(task.name) && this.localPlayer.team.tasksStatus.get(task.name)! === TaskStatus.getEnumValue(TaskStatus.needResolution)) {
                if (task.name.includes("oracle"))
                    OG.runCommand("(send-event *target* 'get-pickup 5 " + (this.run.data.normalCellCost ? 120 : 240) + ".0)");
                else
                    OG.runCommand("(send-event *target* 'get-pickup 5 " + (this.run.data.normalCellCost ? 90 : 180) + ".0)");
            }

            if (!this.localPlayer.team || !this.localPlayer.team.isNewTaskUpdateAdd(task)) return;

            if (this.shouldSendTaskUpdate(task) || task.name === Task.lastboss) {
                task.timerTime = this.run.getTimerShortenedFormat();
                task.user = this.localPlayer.user;

                if (task.name === "citadel-sage-green")
                    this.localPlayer.hasCitadelSkipAccess = false;

                this.sendEvent(EventType.NewTaskUpdate, task);

                //run end
                if (task.name === Task.lastboss && Task.isCompleted(task)) {
                    this.localPlayer.state = PlayerState.Finished;
                    this.sendEvent(EventType.EndPlayerRun, task);
                }
            }
        });
    }

    private shouldSendTaskUpdate(task: GameTask): boolean {
        return this.run!.timer.runState === RunState.Started && this.localPlayer.state !== PlayerState.Finished && this.localPlayer.state !== PlayerState.Forfeit;
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
        return !((this.localSlave?.peer.usesServerCommunication || this.localMaster?.peers.every(x => x.peer.usesServerCommunication)) ?? false) || GameState.hasSignificantPlayerStateChange(this.localPlayer.gameState, newState);
    }


    destroy() {
        this.isBeingDestroyed = true;
        const wasHost = this.localMaster && this.lobby?.host?.id === this.localPlayer.user.id;

        this.resetUser();
        this.lobbySubscription?.unsubscribe();
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