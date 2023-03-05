import { RTCPeerDataConnection } from "./rtc-peer-data-connection";

export class RTCPeer{
    user: string;

    masterDescription: RTCSessionDescriptionInit;
    masterCandidates: RTCIceCandidate[];

    slaveDescription: RTCSessionDescriptionInit;
    slaveCandidates: RTCIceCandidate[];

    constructor (user: string) {
        this.user = user;
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