import { AngularFirestoreDocument } from "@angular/fire/compat/firestore";
import { Subject, Subscription } from "rxjs";
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { LobbyUser } from "../firestore/lobby-user";
import { User } from "../user/user";
import { DataChannelEvent } from "./data-channel-event";
import { RTCPeer, RTCPeerSlaveConnection } from "./rtc-peer";
import { RTCPeerDataConnection } from "./rtc-peer-data-connection";

export class RTCPeerMaster {
    userId: string;

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

        //add user to users list
        doc.ref.get().then(lobbyData => {
            if (!lobbyData.exists) return;
            let lobby = lobbyData.data(); if (!lobby) return;
            lobby = Object.assign(new Lobby(lobby.runData, lobby.creatorId), lobby);

            if (!lobby.hasUser(user.id)) {
                lobby.users.push(new LobbyUser(user));
                doc.set(JSON.parse(JSON.stringify(lobby)));
            }
        });
    }

    onLobbyChange(lobby: Lobby) {
        //check if new users
        lobby.users.filter(x => x.id !== this.userId && !this.peers.some(({ userId: userId }) => userId === x.id)).forEach(user => {

            console.log("master: GOT NEW USER!", user.name);
            //setup user handling
            const peerSubscription = this.lobbyDoc.collection(CollectionName.peerConnections).doc<RTCPeer>(user.id).snapshotChanges().subscribe(snapshot => {
                if (snapshot.payload.metadata.hasPendingWrites) return;
                const peer = snapshot.payload.data(); if (!peer) return;

                console.log("master: Got slave change!");
                this.handlePeerConnectionChanges(peer);
            });
            this.peerSubscriptions.push(peerSubscription);
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
        slave.peer = new RTCPeerDataConnection(this.eventChannel, slave.userId, this.lobbyDoc, true);
        
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
            console.log("Setting connection in db for: ", peer.userId);
            this.lobbyDoc.collection(CollectionName.peerConnections).doc(peer.userId).set(JSON.parse(JSON.stringify(peer)));
        }, 500);
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
        if (this.peerSubscriptions) {
            this.peerSubscriptions.forEach(sub => {
                sub.unsubscribe();
            });
        }
        if (this.peers) {
            this.peers.forEach(pc => {
                pc.peer.destory();
            });
        }
    }
}