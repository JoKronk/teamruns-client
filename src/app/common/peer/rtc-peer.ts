import { Subject } from "rxjs";
import { Lobby } from "../firestore/lobby";
import { DataChannelEvent } from "./data-channel-event";
import { RTCConnection } from "./rtc-connection";
import { UserPositionData } from "../socket/position-data";
import { PlayerBase } from "../player/player-base";
import { DocumentReference } from "@angular/fire/firestore";

export class RTCPeer {
    
    connection: RTCConnection;
    isBeingDestroyed: boolean = false;
    eventChannel: Subject<DataChannelEvent> = new Subject();
    positionChannel: Subject<UserPositionData> | null = new Subject();

    constructor(player: PlayerBase, lobbyRef: DocumentReference<Lobby>, host: PlayerBase) {
        this.connection = new RTCConnection(this.eventChannel, this.positionChannel, lobbyRef, player, host, false);
    }

    destroy() {
        this.isBeingDestroyed = true;
        this.connection.destroy();
    }
}