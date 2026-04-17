import { Subject } from "rxjs";
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { DataChannelEvent } from "./data-channel-event";
import { UserPositionData } from "../socket/position-data";
import { RTCConnection } from "./rtc-connection";
import { collection, DocumentReference, onSnapshot, Unsubscribe } from "@angular/fire/firestore";
import { FireStoreService } from "@app/services/fire-store.service";
import { RTCConnectionDecription } from "./rtc-connection-description";
import { PlayerBase } from "../player/player-base";

export class RTCHost {
    isBeingDestroyed: boolean = false;

    eventChannel: Subject<DataChannelEvent> = new Subject();
    positionChannel: Subject<UserPositionData> | null = null;

    peersUnsubscription: Unsubscribe;
    connections: RTCConnection[] = [];

    constructor(public host: PlayerBase, public lobbyRef: DocumentReference<Lobby>) {
        this.positionChannel = new Subject();

        //setup user handling
        this.peersUnsubscription = onSnapshot(collection(lobbyRef, CollectionName.peerConnections).withConverter(FireStoreService.convert<RTCConnectionDecription>()), (snapshot) => {
            const connections = snapshot.docs.map(x => x.data());
            connections.filter(x => x.peer.user.id !== host.user.id).forEach(connectionDescription => {
                const existingConnection = this.connections.find(x => x.peer.user.id === connectionDescription.peer.user.id);
                if (!existingConnection)
                    this.connections.push(new RTCConnection(this.eventChannel, this.positionChannel, this.lobbyRef, host, connectionDescription.peer, true, connectionDescription));

                else if (connectionDescription.peerCandidates.length != existingConnection.connectionDescription.peerCandidates.length) {
                    existingConnection.addPeerCandidates(connectionDescription);
                }
            });
        });
    }
    

    relayToConnections(event: DataChannelEvent) {
        this.connections.forEach(peer => {
            if (peer.peer.user.id !== event.userId)
                peer.sendEvent(event);
        });
    }

    relayPositionToConnections(target: UserPositionData) {
        this.connections.forEach(peer => {
            if (peer.peer.user.id !== target.userId)
                peer.sendPosition(target);
        });
    }

    sendEventToSpecificConnection(event: DataChannelEvent, userId: string) {
        const peer = this.connections.find(x => x.peer.user.id === userId);
        if (!peer) return;

        peer.sendEvent(event);
    }

    sendPositionToSpecificConnection(positionData: UserPositionData, userId: string) {
        const peer = this.connections.find(x => x.peer.user.id === userId);
        if (!peer) return;

        peer.sendPosition(positionData);
    }


    destroy() {
        this.isBeingDestroyed = true;
        if (this.peersUnsubscription) this.peersUnsubscription();
        if (this.connections) {
            this.connections.forEach(peerConnection => {
                peerConnection.destroy();
            });
        }
    }
}