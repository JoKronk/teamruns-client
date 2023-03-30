import { AngularFirestoreDocument } from "@angular/fire/compat/firestore";
import { Subject, Subscription } from "rxjs";
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { User } from "../user/user";
import { DataChannelEvent } from "./data-channel-event";
import { RTCPeer, RTCPeerSlaveConnection } from "./rtc-peer";
import { RTCPeerDataConnection } from "./rtc-peer-data-connection";

export class RTCPeerMaster {
    userId: string;
    isBeingDestroyed: boolean = false;

    lobbyDoc: AngularFirestoreDocument<Lobby>;
    eventChannel: Subject<DataChannelEvent>;

    peerSubscriptions: Subscription[];
    peers: RTCPeerSlaveConnection[];

    constructor(user: User, doc: AngularFirestoreDocument<Lobby>) {
        this.userId = user.id;
        this.eventChannel = new Subject();
        this.lobbyDoc = doc;
        this.peers = [];
        this.peerSubscriptions = [];
    }

    onLobbyChange(lobby: Lobby) {
        //check for new users
        lobby.users.filter(x => x.id !== this.userId && !this.peers.some(({ userId: userId }) => userId === x.id)).forEach(newPeer => {

            console.log("master: GOT NEW USER!", newPeer.name);
            //setup user handling
            const peerSubscription = this.lobbyDoc.collection(CollectionName.peerConnections).doc<RTCPeer>(newPeer.id).snapshotChanges().subscribe(snapshot => {
                if (snapshot.payload.metadata.hasPendingWrites) return;
                const peer = snapshot.payload.data(); if (!peer) return;

                console.log("master: Got slave change!");
                this.handlePeerConnectionChanges(peer);
            });
            this.peerSubscriptions.push(peerSubscription);
        });
        //check for disconnected users
        this.peers.filter(x => !lobby.users.some(({ id: userId }) => userId === x.userId)).forEach(async (removedPeer) => {
            removedPeer.peer.destroy();
            this.peers = this.peers.filter(x => x.userId !== removedPeer.userId)
        });
    }


    handlePeerConnectionChanges(peer: RTCPeer) {

        let existingSlave = this.peers.find(x => x.userId === peer.userId);
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
    }

    
    async setupNewPeerConnection(peer: RTCPeer) {

        console.log("master: Got new slave, setting up!")
        let slave = peer as RTCPeerSlaveConnection;
        this.peers.push(slave); //pushed here as rapid updates can cause it to be created twice otherwise


        //setup master connection to peer
        slave.peer = new RTCPeerDataConnection(this.eventChannel, this.userId, slave.userId, this.lobbyDoc, true);
        
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
            console.log("master: Setting connection in db for: ", peer.userId);
            this.lobbyDoc.collection(CollectionName.peerConnections).doc(peer.userId).set(JSON.parse(JSON.stringify(this.getPureRTCPeer(peer)))); //peer gets poluted by slave due to it being binded by reference
        }, 500);
    }

    getPureRTCPeer(oldPeer: RTCPeer): RTCPeer {
        let peer = new RTCPeer(oldPeer.userId);
        peer.masterDescription = oldPeer.masterDescription;
        peer.masterCandidates = oldPeer.masterCandidates;
        peer.slaveDescription = oldPeer.slaveDescription;
        peer.slaveCandidates = oldPeer.slaveCandidates;
        return peer;
    }

    relayToSlaves(event: DataChannelEvent) {
        this.peers.forEach(slave => {
            if (slave.userId !== event.userId)
                slave.peer.sendEvent(event);
        });
    }

    respondToSlave(event: DataChannelEvent, userId: string) {
        const peer = this.peers.find(x => x.userId === userId);
        if (!peer) return;

        peer.peer.sendEvent(event);
    }


    destroy() {
        this.isBeingDestroyed = true;
        if (this.peerSubscriptions) {
            this.peerSubscriptions.forEach(sub => {
                sub.unsubscribe();
            });
        }
        if (this.peers) {
            this.peers.forEach(pc => {
                pc.peer.destroy();
            });
        }
    }
}