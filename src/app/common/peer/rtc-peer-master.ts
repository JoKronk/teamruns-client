import { Subject } from "rxjs";
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { UserBase } from "../user/user";
import { DataChannelEvent } from "./data-channel-event";
import { UserPositionData } from "../socket/position-data";
import { RTCPeer } from "./rtc-peer";
import { collection, DocumentReference, onSnapshot, Unsubscribe } from "@angular/fire/firestore";
import { FireStoreService } from "@app/services/fire-store.service";
import { RTCConnectionDecription } from "./rtc-connection-description";

export class RTCPeerMaster {
    user: UserBase;
    isBeingDestroyed: boolean = false;

    eventChannel: Subject<DataChannelEvent> = new Subject();
    positionChannel: Subject<UserPositionData> | null = null;

    peersUnsubscription: Unsubscribe;
    peers: RTCPeer[] = [];

    constructor(user: UserBase, public lobbyRef: DocumentReference<Lobby>) {
        this.user = user;

        this.positionChannel = new Subject();

        //setup user handling
        this.peersUnsubscription = onSnapshot(collection(lobbyRef, CollectionName.peerConnections).withConverter(FireStoreService.convert<RTCConnectionDecription>()), (snapshot) => {
            const peers = snapshot.docs.map(x => x.data());
            peers.filter(x => x.player.user.id !== user.id).forEach(connectionDescription => {
                let existingPeer = this.peers.find(x => x.peer.user.id === connectionDescription.player.user.id);
                if (!existingPeer)
                    this.peers.push(new RTCPeer(this.eventChannel, this.positionChannel, this.lobbyRef, this.user, connectionDescription.player, true, connectionDescription));

                else if (connectionDescription.slaveCandidates.length != existingPeer.connectionDescription.slaveCandidates.length) {
                    existingPeer.addPeerCandidates(connectionDescription);
                }
            });
        });
    }
    

    relayToSlaves(event: DataChannelEvent) {
        this.peers.forEach(peer => {
            if (peer.peer.user.id !== event.userId)
                peer.sendEvent(event);
        });
    }

    relayPositionToSlaves(target: UserPositionData) {
        this.peers.forEach(peer => {
            if (peer.peer.user.id !== target.userId)
                peer.sendPosition(target);
        });
    }

    sendEventToSpecificSlave(event: DataChannelEvent, userId: string) {
        const peer = this.peers.find(x => x.peer.user.id === userId);
        if (!peer) return;

        peer.sendEvent(event);
    }

    sendPositionToSpecificSlave(positionData: UserPositionData, userId: string) {
        const peer = this.peers.find(x => x.peer.user.id === userId);
        if (!peer) return;

        peer.sendPosition(positionData);
    }


    destroy() {
        this.isBeingDestroyed = true;
        if (this.peersUnsubscription) this.peersUnsubscription();
        if (this.peers) {
            this.peers.forEach(peerConnection => {
                peerConnection.destroy();
            });
        }
    }
}