import { UserBase } from "../user/user";
import { RTCPeerDataConnection } from "./rtc-peer-data-connection";

export class RTCPeer{
    user: UserBase;

    masterDescription: RTCSessionDescriptionInit;
    masterCandidates: RTCIceCandidate[];

    slaveDescription: RTCSessionDescriptionInit;
    slaveCandidates: RTCIceCandidate[];

    constructor (user: UserBase) {
        this.user = user;
        this.masterCandidates = [];
        this.slaveCandidates = [];
    }
}


export class RTCPeerSlaveConnection extends RTCPeer {
    peer: RTCPeerDataConnection;

    constructor(user: UserBase) {
        super(user);
    }
}