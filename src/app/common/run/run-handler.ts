import { Run } from "./run";
import { RunMode } from "./run-mode";
import { LocalPlayerData } from "../user/local-player-data";
import { Lobby } from "../firestore/lobby";
import { RTCPeerMaster } from "../peer/rtc-peer-master";
import { RTCPeerSlave } from "../peer/rtc-peer-slave";
import { AngularFirestore, AngularFirestoreDocument } from "@angular/fire/compat/firestore";
import { UserService } from "src/app/services/user.service";
import { Subscription } from "rxjs";
import { DataChannelEvent } from "../peer/data-channel-event";
import { EventType } from "../peer/event-type";
import { PlayerState } from "../player/player-state";
import { RunState } from "./run-state";
import { CollectionName } from "../firestore/collection-name";
import { NgZone } from "@angular/core";
import { Timer } from "./timer";
import { Task } from "../opengoal/task";
import { OG } from "../opengoal/og";
import { Team } from "./team";
import { LobbyUser } from "../firestore/lobby-user";
import { UserBase } from "../user/user";
import { FireStoreService } from "src/app/services/fire-store.service";

export class RunHandler {
    
    lobby: Lobby | undefined;
    run: Run | undefined;

    loaded: boolean = false;
    info: string = "";

    localMaster: RTCPeerMaster | undefined;
    localSlave: RTCPeerSlave | undefined;

    lobbyDoc: AngularFirestoreDocument<Lobby>;
    firestoreService: FireStoreService;
    userService: UserService;
    private localPlayer: LocalPlayerData;
    private obsUserId: string | null;

    zone: NgZone;
    dataSubscription: Subscription;
    lobbySubscription: Subscription;

    constructor(lobbyId: string, firestoreService: FireStoreService, userService: UserService, localUser: LocalPlayerData, zone: NgZone, obsUserId: string | null = null) {
        this.lobbyDoc = firestoreService.getLobbyDoc(lobbyId);
        this.firestoreService = firestoreService;
        this.userService = userService;
        this.localPlayer = localUser;
        this.zone = zone;
        this.obsUserId = obsUserId;

        //when loaded listen on lobby
        this.lobbySubscription = this.lobbyDoc.snapshotChanges().subscribe(snapshot => {
            if (snapshot.payload.metadata.hasPendingWrites) return;
            let lobby = snapshot.payload.data();
            if (!lobby) return;
            this.lobby = Object.assign(new Lobby(lobby.runData, lobby.creatorId), lobby);

            //create run if it doesn't exist
            if (!this.run) {
                console.log("Creating Run!");
                this.run = new Run(this.lobby.runData);

                //setup local user (this should be done here or at some point that isn't instant to give time to load in the user if a dev refresh happens while on run page)
                this.localPlayer.user = this.userService.user.getUserBase();
                this.localPlayer.mode = this.run.data.mode;

                //add user to lobby
                let playerTeam = this.run.getPlayerTeam(obsUserId ? obsUserId : this.localPlayer.user.id);
                if (playerTeam) 
                    this.localPlayer.team = playerTeam;
                else if (this.lobby.hasUser(this.localPlayer.user.id)) {
                    this.lobby.getUser(this.localPlayer.user.id)!.isRunner = false;
                    this.updateFirestoreLobby();
                }
                else {
                    lobby.users.push(new LobbyUser(this.localPlayer.user));
                    this.updateFirestoreLobby();
                }

                //set run info
                this.info = RunMode[this.run.data.mode] + "\n\nSame Level: " + this.run.data.requireSameLevel + "\nSolo Zoomers: " + this.run.data.allowSoloHubZoomers + "\nNormal Cell Cost: " + this.run.data.normalCellCost + "\n\nNo LTS: " + this.run.data.noLTS + "\nNo Citadel Skip: " + this.run.data.noCitadelSkip;
            }

            this.onLobbyChange();
        });

    }


    async onLobbyChange() {
        const userId = this.userService.getId();
        if (!this.lobby) return;

        console.log("Got Lobby Change!");
        //become master if needed (for example host disconnect or no host at start)
        if ((!this.lobby.host || (this.lobby.host.id === userId && !this.localMaster)) && (!this.lobby.backupHost || this.lobby.backupHost.id === userId) && !this.localPlayer.isObs()) {
            console.log("Becomming host!");
            //cleanup own slave connection if previously slave (in for example host disconnect)
            if (this.localSlave) {
                await this.lobbyDoc.collection(CollectionName.peerConnections).doc(userId).delete();
                this.localSlave.destory();
                this.dataSubscription.unsubscribe();
                this.localSlave = undefined;
            }

            this.lobby.host = this.lobby.users.find(x => x.id === userId) ?? null;
            
            if (this.lobby.backupHost?.id === userId) //host is kicked out of user list and lobby host role by backupHost on data channel disconnect
                this.lobby.backupHost = this.lobby.users.find(user => user.isRunner && user.id !== userId) ?? null;
            
            this.updateFirestoreLobby();
            this.setupMaster();
            this.loaded = true;
        }

        //become slave if master exists
        if (!this.localMaster && !this.localSlave)
            this.setupSlave();

        //master checks if lobby has changed
        if(this.localMaster) {
            //check for backupHost disconnect
            if (!this.lobby.backupHost)
                this.lobby.backupHost = this.lobby.users.find(user => user.isRunner && user.id !== userId) ?? null;

            //check for new users/peer connections
            this.localMaster.onLobbyChange(this.lobby);
        }
    }



    setupMaster() {
        console.log("Setting up master!");
        this.localMaster = new RTCPeerMaster(this.userService.user, this.lobbyDoc);
        this.dataSubscription = this.localMaster.eventChannel.subscribe(event => {
            this.onDataChannelEvent(event, true);
        });
    }

    setupSlave() {
        console.log("Setting up slave!");
        this.localSlave = new RTCPeerSlave(this.userService.user, this.lobbyDoc);
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
        else if (this.localMaster)
            this.onDataChannelEvent(event, true);
    }

    onDataChannelEvent(event: DataChannelEvent, isMaster: boolean) {
        const userId = this.userService.getId();

        //send updates to master to all slaves | this should be here and not moved up to sendEvent as it's not the only method triggering this
        if (isMaster && event.type !== EventType.Connect && event.type !== EventType.RequestRunSync && event.type !== EventType.RunSync)
            this.localMaster?.relayToSlaves(event);

        switch (event.type) {

            case EventType.Connect: //rtc stuff on connection is setup individually in rtc-peer-master/slave
                console.log(this.lobby?.getUserNameFromKey(event.userId) + " connected!");
                if (!isMaster) {
                    console.log("Sending run request!");
                    this.sendEvent(EventType.RequestRunSync);
                }
                break;


            case EventType.Disconnect:
                if(!this.lobby) return;

                if (isMaster) {
                    let peer = this.localMaster!.peers.find(x => x.userId === event.userId);
                    if (peer) {
                        peer.peer.destory();
                        this.localMaster!.peers = this.localMaster!.peers.filter(x => x.userId !== event.userId)
                    }

                    this.lobby.users = this.lobby.users.filter(user => user.id !== event.userId);

                    //host on backupHost disconnect
                    if (event.userId === this.lobby.backupHost?.id)
                        this.lobby.backupHost = null; //will be set by host onLobbyChange

                    this.updateFirestoreLobby();
                }
                //kick logic
                else if(this.localPlayer.user.id === event.value && this.lobby.host?.id === event.userId) {
                    this.userService.sendNotification("You've been kicked from the lobby.");
                    this.userService.routeTo('/lobby');
                }
                //backupHost on master disconnect
                else if (event.userId === this.lobby.host?.id && this.lobby.backupHost?.id === userId) {
                    this.lobby.host = null; //current user will pickup host role on the file change
                    this.updateFirestoreLobby();
                }
                break;


            case EventType.RequestRunSync:
                if (isMaster)
                    console.log("Got run request, responding!");
                    this.localMaster?.respondToSlave(new DataChannelEvent(userId, EventType.RunSync, this.run), event.userId);
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
                    
                    //update lobby
                    if (!this.obsUserId && this.lobby && !this.lobby.users.some(x => x.id === userId)) {
                        this.lobby.users.push(new LobbyUser(this.userService.user));
                        this.updateFirestoreLobby();
                    }
                    if (!this.obsUserId && this.lobby) {
                        let updateDb = false;
                        if (this.lobby.hasSpectator(userId)) {
                            this.lobby.getUser(userId)!.isRunner = true;
                            updateDb = true;
                        }
                        else if (!this.lobby.hasRunner(userId)) {
                            this.lobby.users.push(new LobbyUser(this.userService.user, true));
                            updateDb = true;
                        }
                        if (updateDb)
                            this.updateFirestoreLobby();
                    }

                    this.run!.importChanges(this.localPlayer, event.value);
                    this.loaded = true;
                });
                break;



            case EventType.EndPlayerRun:  
                this.zone.run(() => { 
                    this.run?.endPlayerRun(event.userId, event.value);

                    if (isMaster && this.run?.timer.runState === RunState.Ended)
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
                    this.run.giveCellToUser(event.value, this.run.getPlayer(userId));
                    
                    if (this.run.getPlayerTeam(event.userId)?.name === this.localPlayer.team?.name) {
                        //handle klaww kill
                        if ((event.value as Task).gameTask === "ogre-boss") {
                            this.localPlayer.killKlawwOnSpot = true;
                            this.localPlayer.checkKillKlaww();
                        }
                        else //check if orb buy
                            this.localPlayer.checkForFirstOrbCellFromMultiSeller((event.value as Task).gameTask);
                    }
                }

                //handle Lockout
                if (this.run.data.mode === RunMode.Lockout) {
                    const playerTeam = this.run.getPlayerTeam(this.localPlayer.user.id);
                    if (!playerTeam) break;
                    if (this.run.teams.length !== 1) {
                        if (this.localPlayer.gameState.cellCount < 73 || this.run.teams.some(team => team.name !== playerTeam.name && team.cellCount > playerTeam.cellCount))
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
                if (!this.run || this.run.getPlayerTeam(event.userId)?.name !== this.localPlayer.team?.name) return;
                this.localPlayer.updateTaskStatus(new Map(Object.entries(event.value)), event.userId === userId);
                break;

                
            case EventType.ChangeTeam:
                const user: LobbyUser | undefined = this.lobby?.getUser(event.userId);
                if (!user) return;
                if (!user.isRunner) {
                    user.isRunner = true;
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
            

            case EventType.CheckRemoveRunner:
                if(this.run?.timer.runState === RunState.Waiting) {
                    this.zone.run(() => { 
                        this.run?.removePlayer(event.userId);
                    });  
                }
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

    updateFirestoreLobby() {
        this.lobby!.lastUpdateDate = new Date().toUTCString();
        this.lobbyDoc.set(JSON.parse(JSON.stringify(this.lobby)));
    }

    getPlayerState(): void {
        if ((window as any).electron)
            (window as any).electron.send('og-state-read');
    }


    destroy() {
        this.sendEvent(EventType.CheckRemoveRunner);

        const wasHost = this.localMaster && this.lobby?.host?.id === this.localPlayer.user.id;

        this.localMaster?.destroy();
        this.localSlave?.destory();

        this.dataSubscription?.unsubscribe();
        this.lobbySubscription?.unsubscribe();

        if (this.lobby && (wasHost || this.lobby?.host === null)) { //host removes user from lobby otherwise but host has to the job for himself
            if (wasHost) {
                console.log("Removing host!")
                this.lobby.host = null;
            }
            this.lobby.users = this.lobby.users.filter(user => user.id !== this.localPlayer.user.id);
            this.updateFirestoreLobby();
        }
    }
}