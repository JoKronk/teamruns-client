import { PlayerBase } from "../player/player-base";

export class RTCConnectionDecription{
    peer: PlayerBase;

    hostAnswer: RTCSessionDescriptionInit;
    hostCandidates: RTCIceCandidate[];

    peerOffer: RTCSessionDescriptionInit;
    peerCandidates: RTCIceCandidate[];

    constructor (user: PlayerBase) {
        this.peer = user;
        this.hostCandidates = [];
        this.peerCandidates = [];
    }

    static copy(oldDescription: RTCConnectionDecription): RTCConnectionDecription {
        let peer = new RTCConnectionDecription(oldDescription.peer);
        peer.hostAnswer = oldDescription.hostAnswer;
        peer.hostCandidates = oldDescription.hostCandidates;
        peer.peerOffer = oldDescription.peerOffer;
        peer.peerCandidates = oldDescription.peerCandidates;
        return peer;
    }
}