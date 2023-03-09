import { AngularFirestoreDocument } from "@angular/fire/compat/firestore";
import { Subject, Subscription } from "rxjs";
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { DataChannelEvent } from "./data-channel-event";
import { RTCPeer, RTCPeerSlaveConnection } from "./rtc-peer";
import { RTCPeerDataConnection } from "./rtc-peer-data-connection";

export class RTCPeerMaster {
    user: string;

    lobbyDoc: AngularFirestoreDocument<Lobby>;
    dataChannel: Subject<DataChannelEvent>;

    peerSubscriptions: Subscription[];
    peers: RTCPeerSlaveConnection[];

    constructor(user: string, doc: AngularFirestoreDocument<Lobby>) {
        this.user = user;
        this.dataChannel = new Subject();
        this.lobbyDoc = doc;
        this.peers = [];
        this.peerSubscriptions = [];

        //add user to spectate list
        doc.ref.get().then(lobbyData => {
            if (!lobbyData.exists) return;
            let lobby = lobbyData.data();

            if (lobby && !lobby.spectators.concat(lobby.runners).includes(user)) {
                lobby.spectators.push(user);
                doc.set(JSON.parse(JSON.stringify(lobby)));
            }
        });
    }

    onLobbyChange(lobby: Lobby) {
        //check if new users
        lobby.spectators.concat(lobby.runners).filter(x => x !== this.user && !this.peers.some(({ user: user }) => user === x)).forEach(user => {

            console.log("master: GOT NEW USER!", user);
            //setup user handling
            const peerSubscription = this.lobbyDoc.collection(CollectionName.peerConnections).doc<RTCPeer>(user).snapshotChanges().subscribe(snapshot => {
                if (snapshot.payload.metadata.hasPendingWrites) return;
                const peer = snapshot.payload.data();
                if (!peer) return;

                console.log("master: Got slave change!", this.peers);
                this.handlePeerConnectionChanges(peer);
            });
            this.peerSubscriptions.push(peerSubscription);
        });
    }


    handlePeerConnectionChanges(peer: RTCPeer) {

        let existingSlave = this.peers.find(x => x.user === peer.user);
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
        slave.peer = new RTCPeerDataConnection(this.dataChannel, slave.user);
        
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
            console.log("Setting connection in db: ", peer);
            this.lobbyDoc.collection(CollectionName.peerConnections).doc(peer.user).set(JSON.parse(JSON.stringify(peer)));
        }, 500);
    }

    relayToSlaves(event: DataChannelEvent) {
        this.peers.forEach(slave => {
            if (slave.user !== event.user)
                slave.peer.sendEvent(event);
        });
    }

    respondToSlave(event: DataChannelEvent, user: string) {
        const peer = this.peers.find(x => x.user === user);
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