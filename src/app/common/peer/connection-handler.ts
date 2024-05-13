import { Subject, Subscription } from "rxjs";
import { LocalPlayerData } from "../user/local-player-data";
import { RTCPeerMaster } from "./rtc-peer-master";
import { RTCPeerSlave } from "./rtc-peer-slave";
import { DataChannelEvent } from "./data-channel-event";
import { UserPositionData } from "../socket/position-data";
import { User } from "../user/user";
import { Lobby } from "../firestore/lobby";
import { EventType } from "./event-type";
import { AngularFirestoreDocument } from "@angular/fire/compat/firestore";

export class ConnectionHandler {
    
    private localMaster: RTCPeerMaster | undefined;
    localSlave: RTCPeerSlave | undefined; //not private yet as connection logs are read from here !TODO: Change/update

    private localPeers: LocalPlayerData[];
    private mainLocalUser: User;
    lobby: Lobby | undefined;
    isOnlineInstant: boolean;
    
    private dataSubscription: Subscription;
    private positionSubscription: Subscription;
    dataChannelEventSubject: Subject<DataChannelEvent> = new Subject();

    constructor(localPeers: LocalPlayerData[], mainLocalUser: User, isOnlineInstant: boolean) {
        this.localPeers = localPeers;
        this.mainLocalUser = mainLocalUser;
        this.isOnlineInstant = isOnlineInstant;
        this.localMaster = undefined;
        this.localSlave = undefined;
    }

    onLobbyUpdate(lobby: Lobby) {
        this.lobby = lobby;
    }

    reLinkLocalPeers(localPeers: LocalPlayerData[]) {
        this.localPeers = localPeers;
    }

    setupMaster(lobbyDoc: AngularFirestoreDocument<Lobby>) {
        console.log("Setting up master!");
        this.localMaster = new RTCPeerMaster(this.mainLocalUser.getUserBaseWithDisplayName(), lobbyDoc);
        this.dataSubscription = this.localMaster.eventChannel.subscribe(event => {
            if (!this.localMaster?.isBeingDestroyed)
                this.dataChannelEventSubject.next(event);
        });

        if (!this.localMaster.positionChannel) return;
        this.positionSubscription = this.localMaster.positionChannel.subscribe(target => {
            if (!this.localMaster?.isBeingDestroyed)
                this.onPostionChannelUpdate(target, true);
        });
    }

    setupSlave(lobbyDoc: AngularFirestoreDocument<Lobby>) {
        console.log("Setting up slave!");
        this.localSlave = new RTCPeerSlave(this.mainLocalUser.generatePlayerBase(), lobbyDoc, this.lobby!.host!);
        this.dataSubscription = this.localSlave.eventChannel.subscribe(event => {
            if (!this.localSlave?.isBeingDestroyed)
                this.dataChannelEventSubject.next(event);
        });

        if (!this.localSlave.positionChannel) return;
        this.positionSubscription = this.localSlave.positionChannel.subscribe(target => {
            if (!this.localSlave?.isBeingDestroyed)
                this.onPostionChannelUpdate(target, false);
        });
    }


    sendEventAsMain(type: EventType, value: any = null) {
        this.sendEventCommonLogic(new DataChannelEvent(this.mainLocalUser.id, type, value));
    }

    sendEvent(type: EventType, userId: string, value: any = null) {
        this.sendEventCommonLogic(new DataChannelEvent(userId, type, value));
    }

    private sendEventCommonLogic(event: DataChannelEvent) {
        if (this.localSlave) {
            if (this.isOnlineInstant)
                this.localSlave.peer.sendEvent(event);
            this.dataChannelEventSubject.next(event); //to run on a potentially safer but slower mode disable this and send back the event from master/host
        }
        else if (this.localMaster && this.lobby?.host?.user.id === this.mainLocalUser.id && !this.localMaster.isBeingDestroyed)
            this.dataChannelEventSubject.next(event);

        else if (!this.isOnlineInstant)
            this.dataChannelEventSubject.next(event);
    }

    sendPosition(positionData: UserPositionData) {
        this.sendPositionToRemote(positionData);

        //update for local instances
        for (let localP of this.localPeers) {
            if (positionData.userId !== localP.user.id)
                localP.socketHandler.updatePlayerPosition(positionData);
        }
    }

    private sendPositionToRemote(positionData: UserPositionData) {
        if (!this.isOnlineInstant) return;

        if (this.localSlave) {
            this.localSlave.peer.sendPosition(positionData);
        }
        else if (this.localMaster && this.lobby?.host?.user.id === this.mainLocalUser.id && !this.localMaster.isBeingDestroyed)
            this.localMaster?.relayPositionToSlaves(positionData);
    }



    onPostionChannelUpdate(positionData: UserPositionData, isMaster: boolean) {
        //send updates from master to all slaves
        if (isMaster && this.isOnlineInstant)
            this.localMaster?.relayPositionToSlaves(positionData);

        for (let localPlayer of this.localPeers) {
            if (positionData.userId !== localPlayer.user.id)
                localPlayer.socketHandler.updatePlayerPosition(positionData);
        }
    }

    relayToSlaves(event: DataChannelEvent) {
        if (!this.isMaster())
            return;

        this.localMaster?.relayToSlaves(event);
    }

    respondToSlave(event: DataChannelEvent, userId: string) {
        if (!this.isMaster())
            return;

        this.localMaster?.respondToSlave(event, userId);
    }

    destoryPeer(userId: string) {
        if (!this.isMaster())
            return;
        
        if (this.localMaster?.peers) { //yes this is needed
            let peer = this.localMaster.peers.find(x => x.player.user.id === userId);
            if (peer) {
                console.log("Destorying disconnected peer");
                peer.peer.destroy();
                this.localMaster!.peers = this.localMaster!.peers.filter(x => x.player.user.id !== userId);
            }
        }
    }


    isMaster(): boolean {
        return this.localMaster !== undefined;
    }

    isSlave(): boolean {
        return this.localSlave !== undefined;
    }

    getHostId(): string | undefined {
        if (this.isSlave())
            return this.localSlave!.hostId;
        else
            return this.localMaster?.user.id;

    }

    destory() {
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
    }
    
}