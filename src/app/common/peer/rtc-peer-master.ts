import { AngularFirestoreDocument } from "@angular/fire/compat/firestore";
import { Subject, Subscription } from "rxjs";
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { UserBase } from "../user/user";
import { DataChannelEvent } from "./data-channel-event";
import { UserPositionData } from "../socket/position-data";
import { RTCPeer, RTCPeerSlaveConnection } from "./rtc-peer";
import { RTCPeerDataConnection } from "./rtc-peer-data-connection";

export class RTCPeerMaster {
    user: UserBase;
    isBeingDestroyed: boolean = false;

    lobbyDoc: AngularFirestoreDocument<Lobby>;
    eventChannel: Subject<DataChannelEvent> = new Subject();
    positionChannel: Subject<UserPositionData> | null = null;

    peersSubscriptions: Subscription;
    peers: RTCPeerSlaveConnection[] = [];

    constructor(user: UserBase, doc: AngularFirestoreDocument<Lobby>) {
        this.user = user;
        this.lobbyDoc = doc;

        this.positionChannel = new Subject();

        //setup user handling
        this.peersSubscriptions = this.lobbyDoc.collection<RTCPeer>(CollectionName.peerConnections).valueChanges().subscribe(peers => {
            peers.filter(x => x.user.id !== user.id).forEach(peer => {
                let existingSlave = this.peers.find(x => x.user.id === peer.user.id);
                if (!existingSlave) {
                    this.setupNewPeerConnection(peer);
                }
        
                else if (peer.slaveCandidates.length != existingSlave.slaveCandidates.length) {
                    //add all new candidates
                    peer.slaveCandidates.filter(x => !existingSlave!.slaveCandidates.some(({ candidate: candidate }) => candidate === x.candidate)).forEach(candidate => {
                        existingSlave!.peer.connection.addIceCandidate(candidate);
                        console.log("master: Added new slave candidate from db!");
                    });
            
                    existingSlave.slaveCandidates = peer.slaveCandidates;
                }
            });
        });
    }

    
    async setupNewPeerConnection(peer: RTCPeer) {

        console.log("master: GOT NEW USER, setting up!", peer.user.name);
        let slave = peer as RTCPeerSlaveConnection;
        this.peers.push(slave);


        //setup master connection to peer
        slave.peer = new RTCPeerDataConnection(this.eventChannel, this.positionChannel, this.user, slave.user, this.lobbyDoc, true);
        
        slave.peer.connection.onicecandidate = (event) => {
            if (event.candidate) {
                slave.masterCandidates.push(event.candidate);
                console.log("master: Got master candidate!");
            }
        };

        await slave.peer.connection.setRemoteDescription(new RTCSessionDescription(slave.slaveDescription));
        const masterDescription = await slave.peer.connection.createAnswer();
        await slave.peer.connection.setLocalDescription(masterDescription);

        slave.slaveCandidates.forEach(candidate => {
            slave.peer.connection.addIceCandidate(candidate);
        });

        console.log("master: Added new peer, with " + slave.slaveCandidates.length + " existing slave candidates!");


        //answer slave
        peer.masterDescription = masterDescription;

        //!TODO: should setup a better solution for this, check slave side equivalent for further comments on it
        setTimeout(() => {
            if (this.isBeingDestroyed) return;
            console.log("master: Setting connection in db for: ", peer.user.name);
            this.lobbyDoc.collection(CollectionName.peerConnections).doc(peer.user.id).set(JSON.parse(JSON.stringify(this.getPureRTCPeer(peer)))); //peer gets poluted by slave due to it being binded by reference
        }, 500);
    }

    getPureRTCPeer(oldPeer: RTCPeer): RTCPeer {
        let peer = new RTCPeer(oldPeer.user);
        peer.masterDescription = oldPeer.masterDescription;
        peer.masterCandidates = oldPeer.masterCandidates;
        peer.slaveDescription = oldPeer.slaveDescription;
        peer.slaveCandidates = oldPeer.slaveCandidates;
        return peer;
    }

    relayToSlaves(event: DataChannelEvent) {
        this.peers.forEach(slave => {
            if (slave.user.id !== event.userId)
                slave.peer.sendEvent(event);
        });
    }

    relayPositionToSlaves(target: UserPositionData) {
        this.peers.forEach(slave => {
            if (slave.user.id !== target.userId)
                slave.peer.sendPosition(target);
        });
    }

    respondToSlave(event: DataChannelEvent, userId: string) {
        const peer = this.peers.find(x => x.user.id === userId);
        if (!peer) return;

        peer.peer.sendEvent(event);
    }


    destroy() {
        this.isBeingDestroyed = true;
        if (this.peersSubscriptions) this.peersSubscriptions.unsubscribe();
        if (this.peers) {
            this.peers.forEach(pc => {
                pc.peer.destroy();
            });
        }
    }
}