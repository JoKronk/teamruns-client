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
import { UserBase } from "../user/user";
import { FireStoreService } from "src/app/services/fire-store.service";
import { CitadelOptions } from "./run-data";

export class RunHandler {
    
    lobby: Lobby | undefined;
    run: Run | undefined;

    loaded: boolean = false;
    isSelfLobbyUpdate: boolean = true;
    info: string = "";
    isBeingDestroyed: boolean = false;

    localMaster: RTCPeerMaster | undefined;
    localSlave: RTCPeerSlave | undefined;

    firestoreService: FireStoreService;
    userService: UserService;
    private localPlayer: LocalPlayerData;
    private obsUserId: string | null;

    zone: NgZone;
    dataSubscription: Subscription;
    lobbySubscription: Subscription;

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

            //check potential overwrites if needed
            if (!this.isSelfLobbyUpdate && this.hasLobbyOverwrites(lobby))
                return;

            this.isSelfLobbyUpdate = false;
            this.lobby = Object.assign(new Lobby(lobby.runData, lobby.creatorId, lobby.password, lobby.id), lobby);

            //create run if it doesn't exist
            if (!this.run) {
                console.log("Creating Run!");
                this.run = new Run(this.lobby.runData);

                //setup local user (this should be done here or at some point that isn't instant to give time to load in the user if a dev refresh happens while on run page)
                this.localPlayer.user = this.userService.user.getUserBase();
                this.localPlayer.mode = this.run.data.mode;

                //setup lobby user
                if (this.lobby.hasUser(this.localPlayer.user.id)) {
                    this.lobby.removeUser(this.localPlayer.user.id);
                    this.updateFirestoreLobby().then(() => {
                        this.lobby!.addUser(new LobbyUser(this.localPlayer.user));
                        this.updateFirestoreLobby();
                    });
                }
                else {
                    this.lobby.addUser(new LobbyUser(this.localPlayer.user));
                    this.updateFirestoreLobby();
                }


                //set run info
                this.info = RunMode[this.run.data.mode] + "\n\nSame Level: " + this.run.data.requireSameLevel + "\nSolo Zoomers: " + this.run.data.allowSoloHubZoomers + "\nNormal Cell Cost: " + this.run.data.normalCellCost + "\n\nNo LTS: " + this.run.data.noLTS + "\nCitadel Skip: " + CitadelOptions[this.run.data.citadelSkip];
            }

            this.onLobbyChange();
        });

    }


    async onLobbyChange() {
        const userId = this.userService.getId();
        if (!this.lobby) return;
        let runLocalMasterOnLobbyChange = true;

        console.log("Got Lobby Change!");
        //become master if needed (for example host disconnect or no host at start)
        if (this.shouldBecomeHost(userId)) {
            let lobbyUser = this.lobby.users.find(x => x.id === userId);
            if (!lobbyUser) return;

            console.log("Becomming host!");
            //cleanup own slave connection if previously slave (in for example host disconnect)
            if (this.localSlave) {
                this.run?.removePlayer(this.localSlave.hostId);
                this.localSlave.destroy();
                this.dataSubscription.unsubscribe();
                this.firestoreService.deleteLobbySubCollections(this.lobby.id);
                this.localSlave = undefined;
                runLocalMasterOnLobbyChange = false;
            }

            this.lobby.host = lobbyUser;
            
            if (this.lobby.backupHost?.id === userId) //replace backup host if user was backup, host is kicked out of user list and lobby host role by backupHost on data channel disconnect
                this.lobby.setBestAvailableBackupHostCandidate(userId);
            
            this.updateFirestoreLobby();
            this.setupMaster();
            this.loaded = true;
        }


        //slave checks on lobby change
        if (!this.localMaster) {
            //kill current slave connection if new host
            if (this.localSlave && this.localSlave.hostId !== this.lobby.host?.id) {
                this.localSlave.destroy();
                this.localSlave = undefined;
            }

            //become slave if not already and master exists
            if (!this.localSlave && this.lobby.host)
                this.setupSlave();
        }

        //master checks on lobby change
        else {
            //check for backupHost disconnect
            if (!this.lobby.backupHost)
                this.lobby.setBestAvailableBackupHostCandidate(userId);

            //check for new users/peer connections
            if (runLocalMasterOnLobbyChange)
                this.localMaster.onLobbyChange(this.lobby);
        }
    }

    hasLobbyOverwrites(newLobby: Lobby): boolean {
        if (!this.lobby) return false;
        const isHost: boolean = (this.lobby.host?.id === this.localPlayer.user.id && this.localMaster !== undefined);
        if (!isHost) return false;

        let updateDb = false;
        let spectators = newLobby.users.filter(x => !x.isRunner);
        spectators.forEach(spectator => {
            if (this.run?.getPlayer(spectator.id)) {
                spectator.isRunner = true;
                updateDb = true;
            }
        });

        if (isHost && newLobby.host?.id !== this.localPlayer.user.id) {
            newLobby.host = this.lobby.host;
            updateDb = true;
        }

        if (updateDb) {
            this.lobby = Object.assign(new Lobby(newLobby.runData, newLobby.creatorId, newLobby.password, newLobby.id), newLobby);
            this.updateFirestoreLobby();
            return true;
        }
        return false;
    }

    shouldBecomeHost(userId: string): boolean {
        if (!this.lobby) return false;
        if (!this.lobby.host || (this.lobby.host.id === userId && !this.localMaster)) {
            const users = this.lobby.users.filter(x => this.run?.getPlayer(x.id)?.state !== PlayerState.Disconnected && !x.id.startsWith("OBS-"));
            if (this.lobby.backupHost && !this.lobby.hasUser(this.lobby?.backupHost?.id))
                this.lobby.backupHost = null;

            //lets backuphost or first runner in user list marked as runner become host
            if (((!this.lobby.backupHost && users.length !== 0 && users[0].id === this.localPlayer.user.id) || this.lobby.backupHost?.id === userId || this.lobby.host?.id === userId))
                return true;
        }
        return false;
    } 

    dehost() { //used only for testing atm, cannot currently be used if host is in a team as he's removed from the team on dehost
        if (!this.localMaster || !this.lobby) return;
        console.log("dehosting");
        this.localMaster.destroy();
        this.localMaster = undefined;
        this.lobby.host = null;
        this.lobby.setBestAvailableBackupHostCandidate(this.localPlayer.user.id);
        this.updateFirestoreLobby();
    }


    setupMaster() {
        console.log("Setting up master!");
        this.localMaster = new RTCPeerMaster(this.userService.user, this.firestoreService.getLobbyDoc(this.lobby!.id));
        this.dataSubscription = this.localMaster.eventChannel.subscribe(event => {
            if (this.localMaster && !this.localMaster.isBeingDestroyed)
            this.onDataChannelEvent(event, true);
        });
    }

    setupSlave() {
        console.log("Setting up slave!");
        this.localSlave = new RTCPeerSlave(this.userService.user, this.firestoreService.getLobbyDoc(this.lobby!.id), this.lobby!.host!);
        this.dataSubscription = this.localSlave.eventChannel.subscribe(event => {
            this.onDataChannelEvent(event, false);
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

    onDataChannelEvent(event: DataChannelEvent, isMaster: boolean) {
        const userId = this.userService.getId();

        //send updates to master to all slaves | this should be here and not moved up to sendEvent as it's not the only method triggering this
        if (isMaster && event.type !== EventType.Connect && event.type !== EventType.RequestRunSync && event.type !== EventType.RunSync)
            this.localMaster?.relayToSlaves(event);

        switch (event.type) {

            case EventType.Connect: //rtc stuff on connection is setup individually in rtc-peer-master/slave
                if (event.userId === "host")
                    this.userService.sendNotification("Client to server fallback communication established,\n please recreate the lobby if peer to peer usually works.", 10000);
                else
                    console.log(this.lobby?.getUserNameFromKey(event.userId) + " connected!");

                if (!isMaster) {
                    console.log("Sending run request!");
                    this.sendEvent(EventType.RequestRunSync);
                }
                break;


            case EventType.Disconnect:
                if(!this.lobby) return;
                this.run?.removePlayer(event.value);

                //host logic
                if (isMaster) {
                    if (this.localMaster?.peers) { //yes this is needed
                        let peer = this.localMaster.peers.find(x => x.userId === event.value);
                        if (peer) {
                            console.log("Destorying disconnected peer");
                            peer.peer.destroy();
                            this.localMaster!.peers = this.localMaster!.peers.filter(x => x.userId !== event.value);
                            this.localMaster!.peerIds = this.localMaster!.peerIds.filter(userId => userId !==  event.value);
                        }
                    }

                    let updateDb = false;

                    if (this.lobby.hasUser(event.value)) {
                        this.lobby.removeUser(event.value);
                        updateDb = true;
                    }

                    //host on backupHost disconnect
                    if (event.value === this.lobby.backupHost?.id) {
                        this.lobby.backupHost = null; //will be set by host onLobbyChange
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
                if(this.localPlayer.user.id === event.value && (this.lobby?.host?.id === event.userId || this.localPlayer.user.id === event.userId)) {
                    this.userService.sendNotification("You've been kicked from the lobby.");
                    this.userService.routeTo('/lobby');
                }
                break;


            case EventType.Reconnect:
                this.zone.run(() => {
                    this.run!.reconnectPlayer(event.userId); 
                }); 
                break;
               
                
            case EventType.RequestRunSync:
                if (isMaster) {
                    this.localMaster?.respondToSlave(new DataChannelEvent(userId, EventType.RunSync, this.run), event.userId);
                    console.log("Got run request, responding!");

                    if (this.localMaster && this.localMaster.peers.length > 1 && this.localMaster.peers.every(x => x.peer.usesServerCommunication)) {
                        this.userService.sendNotification("Unfit as host for lobby of this size, please rejoin for a normal role.");
                        if (this.lobby?.backupHost === null) {
                            this.lobby.setBestAvailableBackupHostCandidate(userId);
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

                        if (playerTeam.players.some(x => x.user.id === this.localPlayer.user.id && x.state === PlayerState.Disconnected))
                            this.sendEvent(EventType.Reconnect);
                    }
                    
                    //add to lobby if missing
                    if (!this.obsUserId && this.lobby && !this.lobby.hasUser(userId)) {
                        this.lobby.addUser(new LobbyUser(this.userService.user));
                        this.updateFirestoreLobby();
                    }

                    //set runner as runner if reconnect
                    if (!this.obsUserId && this.lobby && this.run.getPlayer(userId)) {
                        let updateDb = false;
                        if (this.lobby.hasSpectator(userId)) {
                            this.lobby.getUser(userId)!.isRunner = true;
                            if (!this.lobby.runnerIds.includes(userId))
                                this.lobby.runnerIds.push(userId);

                            updateDb = true;
                        }
                        else if (!this.lobby.hasRunner(userId)) {
                            this.lobby.addUser(new LobbyUser(this.userService.user, true));
                            updateDb = true;
                        }
                        if (updateDb)
                            this.updateFirestoreLobby();
                    }

                    this.run!.importTaskChanges(this.localPlayer, event.value);
                    this.loaded = true;
                });
                break;



            case EventType.EndPlayerRun:  
                this.zone.run(() => { 
                    this.run?.endPlayerRun(event.userId, event.value);

                    if (isMaster && this.run?.timer.runState === RunState.Ended && !this.run.teams.flatMap(x => x.players).every(x => x.state === PlayerState.Forfeit))
                        this.firestoreService.addRun(this.run);
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
                
                const player = this.run.getPlayer(userId);
                if (player) {
                    this.run.onUserStateChange(this.localPlayer, player);
                    if (event.userId !== userId)
                        this.localPlayer.checkForZoomerTalkSkip(event.value);
                } 
                break;


            case EventType.NewTaskStatusUpdate:
                if (!this.run) return;
                if (this.run.getPlayerTeam(event.userId)?.id === this.localPlayer.team?.id && !(this.run.isMode(RunMode.Lockout) && this.run.teams.length === 1))
                    this.localPlayer.updateTaskStatus(new Map(Object.entries(event.value)), event.userId === userId, false);
                else if (this.run.data.sharedWarpGatesBetweenTeams)
                    this.localPlayer.updateTaskStatus(new Map(Object.entries(event.value)), event.userId === userId, true);
                break;

                
            case EventType.ChangeTeam:
                const user: LobbyUser | undefined = this.lobby?.getUser(event.userId);
                if (!user) return;
                if (!user.isRunner) {
                    user.isRunner = true;
                    if (!this.lobby!.runnerIds.includes(user.id))
                        this.lobby!.runnerIds.push(user.id);
                    if (isMaster)
                        this.updateFirestoreLobby();
                }
                this.zone.run(() => { 
                    this.run?.changeTeam(new UserBase(user.id, user.name, user.twitchName), event.value);

                    //check set team for obs window, set from run component if normal user
                    if (this.obsUserId && this.obsUserId === event.userId) { 
                        this.localPlayer.team = this.run?.getPlayerTeam(this.obsUserId);
                    }
                });
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
        if (!this.lobby) return;
        this.lobby.lastUpdateDate = new Date().toUTCString();
        this.isSelfLobbyUpdate = true;
        await this.firestoreService.updateLobby(this.lobby);
    }

    getPlayerState(): void {
        if ((window as any).electron)
            (window as any).electron.send('og-state-read');
    }


    destroy() {
        this.isBeingDestroyed = true;
        const wasHost = this.localMaster && this.lobby?.host?.id === this.localPlayer.user.id;

        this.localMaster?.destroy();
        this.localSlave?.destroy();

        this.dataSubscription?.unsubscribe();
        this.lobbySubscription?.unsubscribe();

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