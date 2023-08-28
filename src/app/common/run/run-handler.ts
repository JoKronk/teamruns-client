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
import { DbPb } from "../firestore/db-pb";
import { PositionData, UserPositionDataTimestamp } from "../playback/position-data";
import { PositionHandler } from "../playback/position-handler";

export class RunHandler {
    
    lobby: Lobby | undefined;
    run: Run | undefined;

    connected: boolean = false;
    info: string = "";
    isBeingDestroyed: boolean = false;
    becomeHostQuickAccess: boolean;

    localMaster: RTCPeerMaster | undefined;
    localSlave: RTCPeerSlave | undefined;

    firestoreService: FireStoreService;
    userService: UserService;
    private localPlayer: LocalPlayerData;
    private obsUserId: string | null;

    zone: NgZone;
    dataSubscription: Subscription;
    positionSubscription: Subscription;
    lobbySubscription: Subscription;
    positionListener: any;

    positionHandler: PositionHandler = new PositionHandler();

    constructor(lobbyId: string, firestoreService: FireStoreService, userService: UserService, localUser: LocalPlayerData, zone: NgZone, obsUserId: string | null = null) {
        this.firestoreService = firestoreService;
        this.userService = userService;
        this.localPlayer = localUser;
        this.zone = zone;
        this.obsUserId = obsUserId;

        //when loaded listen on lobby
        this.lobbySubscription = this.firestoreService.getLobbyDoc(lobbyId).snapshotChanges().subscribe(snapshot => {
            if (snapshot.payload.metadata.hasPendingWrites || this.isBeingDestroyed) return;
            let lobby = snapshot.payload.data();
            if (!lobby) return;

            this.lobby = Object.assign(new Lobby(lobby.runData, lobby.creatorId, lobby.password, lobby.id), lobby);

            //create run if it doesn't exist
            if (!this.run) {
                console.log("Creating Run!");
                this.run = new Run(this.lobby.runData);

                //setup local user (this should be done here or at some point that isn't instant to give time to load in the user if a dev refresh happens while on run page)
                this.localPlayer.user = this.userService.user.createUserBaseFromDisplayName();
                this.localPlayer.mode = this.run.data.mode;
                this.run.spectators.push(new Player(this.localPlayer.user));

                //set run info
                if (this.run.data.category == 0)
                    this.info = this.run.data.name + "\n\nSame Level: " + this.run.data.requireSameLevel + "\nSolo Zoomers: " + this.run.data.allowSoloHubZoomers + "\nNormal Cell Cost: " + this.run.data.normalCellCost + "\nNo LTS: " + this.run.data.noLTS + "\nCitadel Skip: " + CitadelOption[this.run.data.citadelSkip];
                else
                    this.info = this.run.data.name + "\n\n" + RunMode[this.run.data.mode] + "\nCategory: " + Category.GetGategories()[this.run.data.category].displayName + "\nSame Level: " + this.run.data.requireSameLevel;

                //setup position listener
                if (!this.run.data.hideOtherPlayers) {
                    this.positionListener = (window as any).electron.receive("og-position-update", (target: PositionData) => {
                        this.sendPosition(new UserPositionDataTimestamp(target, this.run?.timer.totalMs ?? 0, this.localPlayer.user.id));
                    });
                }
            }

            this.onLobbyChange();
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
            this.positionHandler.updatePosition(target);
    }

    onDataChannelEvent(event: DataChannelEvent, isMaster: boolean) {
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
                    const isRunner: boolean = (this.run?.getPlayerTeam(newUser.id) !== undefined);
                    if (isRunner) 
                        this.sendEvent(EventType.Reconnect, newUser.id);
                    else if (!this.run?.hasSpectator(newUser.id))
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
                else if (!this.run?.hasSpectator(newUser.id))
                    this.run!.spectators.push(new Player(newUser));

                break;


            case EventType.Disconnect:
                if(!this.lobby) return;
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
                if(this.localPlayer.user.id === event.value.id && (this.lobby?.host?.id === event.userId || this.localPlayer.user.id === event.userId)) {
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
                    this.run = Object.assign(new Run(run.data), run).reconstructRun();
                    
                    //update player and team
                    this.localPlayer.mode = this.run.data.mode;
                    let playerTeam = this.run?.getPlayerTeam(this.obsUserId ? this.obsUserId : this.localPlayer.user.id);
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
                    this.run?.endPlayerRun(event.userId, event.value.gameTask === Task.forfeit);
                    this.run?.isMode(RunMode.Lockout) ? this.run.endAllTeamsRun(event.value) : this.run?.endTeamRun(event.value);

                    if (isMaster && this.run?.timer.runState === RunState.Ended && !this.run.teams.flatMap(x => x.players).every(x => x.state === PlayerState.Forfeit)) {
                        let run = DbRun.convertToFromRun(this.run);
                        this.firestoreService.addRun(run);
                        run.checkUploadPbs(this.firestoreService);
                    }
                });
                break;


            case EventType.NewCell: 
                if (!this.run) return;
                this.zone.run(() => { 
                    this.run!.addSplit(event.value);
                });

                //handle none current user things
                if (event.userId !== userId) {
                    this.run.giveCellToUser(event.value, userId);
                    
                    if (this.run.getPlayerTeam(event.userId)?.id === this.localPlayer.team?.id || this.run.isMode(RunMode.Lockout)) {
                        //handle klaww kill
                        if ((event.value as Task).gameTask === "ogre-boss") {
                            this.localPlayer.killKlawwOnSpot = true;
                            this.localPlayer.checkKillKlaww();
                        }
                        //handle citadel elevator cell cases
                        else if ((event.value as Task).gameTask === "citadel-sage-green") {
                            this.localPlayer.checkCitadelSkip(this.run);
                            this.localPlayer.checkCitadelElevator();
                        }
                        else //check if orb buy
                            this.localPlayer.checkForFirstOrbCellFromMultiSeller((event.value as Task).gameTask);
                    }
                }

                //handle Lockout
                if (this.run.isMode(RunMode.Lockout)) {
                    const playerTeam = this.run.getPlayerTeam(this.localPlayer.user.id);
                    if (!playerTeam) break;
                    if (this.run.teams.length !== 1) {
                        if (this.localPlayer.gameState.cellCount < 73 || this.run.teams.some(team => team.id !== playerTeam.id && team.cellCount > playerTeam.cellCount))
                            OG.removeFinalBossAccess(this.localPlayer.gameState.currentLevel);
                        else
                            OG.giveFinalBossAccess(this.localPlayer.gameState.currentLevel);
                    }
                    //free for all Lockout
                    else {
                        const localPlayer = this.run.getPlayer(this.localPlayer.user.id)!;
                        if (this.localPlayer.gameState.cellCount < 73 || playerTeam.players.some(player => player.user.id !== localPlayer.user.id && player.cellsCollected > localPlayer.cellsCollected))
                            OG.removeFinalBossAccess(this.localPlayer.gameState.currentLevel);
                        else
                            OG.giveFinalBossAccess(this.localPlayer.gameState.currentLevel);
                    }
                }
                break;


            case EventType.NewPlayerState: 
                if (!this.run) return;
                this.zone.run(() => { 
                    this.run!.updateState(event.userId, event.value);
                });
                
                this.run.onUserStateChange(this.localPlayer, this.run.getPlayer(userId));
                if (event.userId !== userId)
                    this.localPlayer.checkForZoomerTalkSkip(event.value);
                break;


            case EventType.NewTaskStatusUpdate:
                if (!this.run) return;
                if (this.run.getPlayerTeam(event.userId)?.id === this.localPlayer.team?.id && !(this.run.isMode(RunMode.Lockout) && this.run.teams.length === 1))
                    this.localPlayer.updateTaskStatus(new Map(Object.entries(event.value)), event.userId === userId, false);
                else if (this.run.data.sharedWarpGatesBetweenTeams)
                    this.localPlayer.updateTaskStatus(new Map(Object.entries(event.value)), event.userId === userId, true);
                break;

                
            case EventType.ChangeTeam:
                this.zone.run(() => { 
                    this.run?.changeTeam(this.getUser(event.userId)?.user, event.value);

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
                let team = this.run?.getPlayerTeam(event.userId);
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
                    this.getPlayerState();
                });  
                //!TODO: could be done in some more elegant way
                setTimeout(() => {
                    this.localPlayer.resetRunDependentProperties();
                }, this.run!.timer.countdownSeconds * 1000)
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

    getPlayerState(): void {
        if ((window as any).electron)
            (window as any).electron.send('og-state-read');
    }


    destroy() {
        this.isBeingDestroyed = true;
        const wasHost = this.localMaster && this.lobby?.host?.id === this.localPlayer.user.id;

        this.resetUser();
        this.lobbySubscription?.unsubscribe();
        this.positionListener();

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