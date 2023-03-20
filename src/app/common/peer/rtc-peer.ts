import { RTCPeerDataConnection } from "./rtc-peer-data-connection";

export class RTCPeer{
    userId: string;

    masterDescription: RTCSessionDescriptionInit;
    masterCandidates: RTCIceCandidate[];

    slaveDescription: RTCSessionDescriptionInit;
    slaveCandidates: RTCIceCandidate[];

    constructor (user: string) {
        this.userId = user;
        this.masterCandidates = [];
        this.slaveCandidates = [];
    }
}


export class RTCPeerSlaveConnection extends RTCPeer {
    peer: RTCPeerDataConnection;

    constructor(user: string) {
        super(user);
    }
}