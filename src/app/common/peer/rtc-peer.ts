import { RTCPeerDataConnection } from "./rtc-peer-data-connection";

export class RTCPeer{
    userId: string;

    masterDescription: RTCSessionDescriptionInit;
    masterCandidates: RTCIceCandidate[];

    slaveDescription: RTCSessionDescriptionInit;
    slaveCandidates: RTCIceCandidate[];

    constructor (userId: string) {
        this.userId = userId;
        this.masterCandidates = [];
        this.slaveCandidates = [];
    }
}


export class RTCPeerSlaveConnection extends RTCPeer {
    peer: RTCPeerDataConnection;

    constructor(userId: string) {
        super(userId);
    }
}