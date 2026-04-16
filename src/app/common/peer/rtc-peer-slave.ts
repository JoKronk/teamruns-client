import { Subject } from "rxjs";
import { Lobby } from "../firestore/lobby";
import { DataChannelEvent } from "./data-channel-event";
import { RTCPeer } from "./rtc-peer";
import { UserPositionData } from "../socket/position-data";
import { PlayerBase } from "../player/player-base";
import { DocumentReference } from "@angular/fire/firestore";

export class RTCPeerSlave {
    
    peer: RTCPeer;
    isBeingDestroyed: boolean = false;
    eventChannel: Subject<DataChannelEvent> = new Subject();
    positionChannel: Subject<UserPositionData> | null = new Subject();

    constructor(player: PlayerBase, lobbyRef: DocumentReference<Lobby>, host: PlayerBase) {
        this.peer = new RTCPeer(this.eventChannel, this.positionChannel, lobbyRef, player, host, false);
    }

    destroy() {
        this.isBeingDestroyed = true;
        this.peer.destroy();
    }
}