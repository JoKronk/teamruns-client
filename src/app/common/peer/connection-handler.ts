import { Subject, Subscription } from "rxjs";
import { LocalPlayerData } from "../user/local-player-data";
import { RTCHost } from "./rtc-host";
import { RTCPeer } from "./rtc-peer";
import { DataChannelEvent } from "./data-channel-event";
import { UserPositionData } from "../socket/position-data";
import { User } from "../user/user";
import { Lobby } from "../firestore/lobby";
import { EventType } from "./event-type";
import { DocumentReference } from "@angular/fire/firestore";

export class ConnectionHandler {
    
    private host: RTCHost | undefined;
    peer: RTCPeer | undefined; //not private yet as connection logs are read from here !TODO: Change/update

    localPeers: LocalPlayerData[];
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
        this.host = undefined;
        this.peer = undefined;
    }

    onLobbyUpdate(lobby: Lobby) {
        this.lobby = lobby;
    }

    reLinkLocalPeers(localPeers: LocalPlayerData[]) {
        this.localPeers = localPeers;
    }

    setupAsHost(lobbyDoc: DocumentReference<Lobby>) {
        console.log("Setting up host!");
        this.host = new RTCHost(this.mainLocalUser.generatePlayerBase(), lobbyDoc);
        this.dataSubscription = this.host.eventChannel.subscribe(event => {
            if (!this.host?.isBeingDestroyed)
                this.dataChannelEventSubject.next(event);
        });

        if (!this.host.positionChannel) return;
        this.positionSubscription = this.host.positionChannel.subscribe(target => {
            if (!this.host?.isBeingDestroyed)
                this.onPostionChannelUpdate(target, true);
        });
    }

    setupAsPeer(lobbyDoc: DocumentReference<Lobby>) {
        console.log("Setting up peer!");
        this.peer = new RTCPeer(this.mainLocalUser.generatePlayerBase(), lobbyDoc, this.lobby!.host!);
        this.dataSubscription = this.peer.eventChannel.subscribe(event => {
            if (!this.peer?.isBeingDestroyed)
                this.dataChannelEventSubject.next(event);
        });

        if (!this.peer.positionChannel) return;
        this.positionSubscription = this.peer.positionChannel.subscribe(target => {
            if (!this.peer?.isBeingDestroyed)
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
        if (this.peer) {
            if (this.isOnlineInstant)
                this.peer.connection.sendEvent(event);
            this.dataChannelEventSubject.next(event); //to run on a potentially safer but slower mode disable this and send back the event from master/host
        }
        else if (this.host && this.lobby?.host?.user.id === this.mainLocalUser.id && !this.host.isBeingDestroyed)
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

        if (this.peer) {
            this.peer.connection.sendPosition(positionData);
        }
        else if (this.host && this.lobby?.host?.user.id === this.mainLocalUser.id && !this.host.isBeingDestroyed)
            this.host?.relayPositionToConnections(positionData);
    }



    onPostionChannelUpdate(positionData: UserPositionData, isMaster: boolean) {
        //send updates from host to all peers
        if (isMaster && this.isOnlineInstant)
            this.host?.relayPositionToConnections(positionData);

        for (let localPlayer of this.localPeers) {
            if (positionData.userId !== localPlayer.user.id)
                localPlayer.socketHandler.updatePlayerPosition(positionData);
        }
    }

    relayToPeers(event: DataChannelEvent) {
        if (!this.isHost())
            return;

        this.host?.relayToConnections(event);
    }

    respondToPeer(data: DataChannelEvent | UserPositionData, userId: string) {
        if (!this.isHost())
            return;

        if (data instanceof DataChannelEvent)
            this.host?.sendEventToSpecificConnection(data, userId);
        else
            this.host?.sendPositionToSpecificConnection(data, userId);
    }

    destoryPeer(userId: string) {
        if (!this.isHost())
            return;
        
        if (this.host?.connections) { //yes this is needed
            let peer = this.host.connections.find(x => x.peer.user.id === userId);
            if (peer) {
                console.log("Destorying disconnected peer");
                peer.destroy();
                this.host!.connections = this.host!.connections.filter(x => x.peer.user.id !== userId);
            }
        }
    }


    isHost(): boolean {
        return !this.isOnlineInstant || this.host !== undefined;
    }

    isPeer(): boolean {
        return this.peer !== undefined;
    }

    isPotentialTurnServerHost(): boolean {
        if (this.host === undefined || this.host.connections.length <= 1)
            return false;

        for (let peer of this.host.connections) {
            for (let candidate of peer.connectionDescription.hostCandidates) {
                if (candidate.type === "host")
                    continue;
                
                if (candidate.type !== "relay")
                    return false;
            }
        }
        return true;
    }

    getHostId(): string | undefined {
        if (this.isPeer())
            return this.peer!.connection.peer.user.id;
        else
            return this.host?.host.user.id;
    }

    destory() {
        this.dataSubscription?.unsubscribe();
        this.positionSubscription?.unsubscribe();

        if (this.peer) {
            this.peer.destroy();
            this.peer = undefined;
        }
        if (this.host) {
            this.host.destroy();
            this.host = undefined;
        }
    }
    
}