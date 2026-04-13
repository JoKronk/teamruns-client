import { PlayerBase } from "../player/player-base";

export class RTCConnectionDecription{
    player: PlayerBase;

    masterDescription: RTCSessionDescriptionInit;
    masterCandidates: RTCIceCandidate[];

    slaveDescription: RTCSessionDescriptionInit;
    slaveCandidates: RTCIceCandidate[];

    constructor (user: PlayerBase) {
        this.player = user;
        this.masterCandidates = [];
        this.slaveCandidates = [];
    }

    static copy(oldDescription: RTCConnectionDecription): RTCConnectionDecription {
        let peer = new RTCConnectionDecription(oldDescription.player);
        peer.masterDescription = oldDescription.masterDescription;
        peer.masterCandidates = oldDescription.masterCandidates;
        peer.slaveDescription = oldDescription.slaveDescription;
        peer.slaveCandidates = oldDescription.slaveCandidates;
        return peer;
    }
}