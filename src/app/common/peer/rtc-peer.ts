import { PlayerBase } from "../player/player-base";
import { RTCPeerDataConnection } from "./rtc-peer-data-connection";

export class RTCPeer{
    player: PlayerBase;

    masterDescription: RTCSessionDescriptionInit;
    masterCandidates: RTCIceCandidate[];

    slaveDescription: RTCSessionDescriptionInit;
    slaveCandidates: RTCIceCandidate[];

    constructor (player: PlayerBase) {
        this.player = player;
        this.masterCandidates = [];
        this.slaveCandidates = [];
    }
}


export class RTCPeerSlaveConnection extends RTCPeer {
    peer: RTCPeerDataConnection;

    constructor(player: PlayerBase) {
        super(player);
    }
}