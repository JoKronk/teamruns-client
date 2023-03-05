import { AngularFirestoreDocument } from "@angular/fire/compat/firestore";
import { Subject, Subscription } from "rxjs";
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { DataChannelEvent } from "./data-channel-event";
import { EventType } from "./event-type";
import { RTCPeer } from "./rtc-peer";
import { RTCPeerDataConnection } from "./rtc-peer-data-connection";

export class RTCPeerSlave {
    private currentMasterSdp: string | undefined;

    peer: RTCPeerDataConnection;
    peerDoc: AngularFirestoreDocument<RTCPeer>;
    peerDocSubscription: Subscription;
    
    dataChannel: Subject<DataChannelEvent>;

    peerData: RTCPeer;

    constructor(user: string, doc: AngularFirestoreDocument<Lobby>) {
        this.dataChannel = new Subject();
        this.peerDoc = doc.collection<RTCPeer>(CollectionName.peerConnections).doc(user);
        this.peerData = new RTCPeer(user);

        this.preCreationCleanup(user, doc, this.peerDoc);
    }

    private async preCreationCleanup(user: string, lobbyDoc: AngularFirestoreDocument<Lobby>, peerDoc: AngularFirestoreDocument<RTCPeer>) {
        //add user to spectate list (await this.runs.doc(id).ref.get()).data()
        let lobbyData = await lobbyDoc.ref.get();
        if (!lobbyData.exists) return;
        let lobby = lobbyData.data()
        if (!lobby) return;

        let peer = await peerDoc.ref.get();
        let pushUserToSpectators = true;

        if (peer.exists) {
            console.log("slave: Peer connection exists from before, deleting!");
            await peerDoc.delete();
            
            //make sure user is not reconnecting from a disconnect, temp removal is needed if so to let host know that user needs a new connection
            if (lobby.runners.includes(user)) {
                lobby.runners = lobby.runners.filter(x => x !== user);
                await this.updateFirestoreLobby(lobbyDoc, lobby);

                lobby!.runners.push(user);
                this.updateFirestoreLobby(lobbyDoc, lobby!);
                pushUserToSpectators = false;
            }

            if (lobby.spectators.includes(user)) {
                lobby.spectators = lobby.spectators.filter(x => x !== user);
                await this.updateFirestoreLobby(lobbyDoc, lobby);
            }
        }

        if (pushUserToSpectators) {
            lobby!.spectators.push(user);
            await this.updateFirestoreLobby(lobbyDoc, lobby);
        }

        this.createPeerConnection(user);
    }

    private async updateFirestoreLobby(doc: AngularFirestoreDocument<Lobby>, lobby: Lobby) {
        await doc.set(JSON.parse(JSON.stringify(lobby)));
    }

    private async createPeerConnection(user: string) {
        this.peer = new RTCPeerDataConnection(this.dataChannel, user);

        //listen for slave candidates to be created, might need to be done before .createOffer() according to some unlisted documentation
        this.peer.connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.peerData.slaveCandidates.push(event.candidate);
                console.log("slave: Got slave candidate!");
                //this.peerDoc.set(JSON.parse(JSON.stringify(this.peerData))); WE GIVE THE CLIENT SOME TIME TO FETCH THESE INSTEAD AND PUSHES ONCE TO DODGE OVERWRITE ON MASTER CANDIDATES
            }
        };

        //create slave offer/description this automatically should start fetching ice candidates for the slave
        const slaveDescription = await this.peer.connection.createOffer();
        await this.peer.connection.setLocalDescription(slaveDescription);
        this.peerData.slaveDescription = slaveDescription;
        
        //!TODO: Find some more elegant way to do this, we need to dodge overwriting master candidates and the same the other way around
        //One solution is to have a seperate doc for -> connections, master candidates, slave candidates
        setTimeout(() => {
            this.peerDoc.set(JSON.parse(JSON.stringify(this.peerData)));
            console.log("slave: Created slave offer!", this.peerData);
        }, 500);

        
        //listen for master connection response
        this.peerDocSubscription = this.peerDoc.snapshotChanges().subscribe((snapshot) => {
            if (snapshot.payload.metadata.hasPendingWrites) return;
            const data = snapshot.payload.data();
            if (!data) return;

            //check master description creation
            if (data.masterDescription && (!this.peer.connection.currentRemoteDescription || this.currentMasterSdp !== data.masterDescription.sdp)) {
                console.log("slave: Got new host!");
                this.currentMasterSdp = data.masterDescription.sdp;
                const answerDescription = new RTCSessionDescription(data.masterDescription);
                this.peer.connection.setRemoteDescription(answerDescription);
            }

            //check ice candidate add
            //this check will surely create some edge case bug in the future if candidates is bound to a max pool size and going above the set limit throws an error, 
            //but something like > instead of != will surely create a bug if ice candidates are reset in the db instead, I'll come back and feel stupid about this later
            if (data.masterCandidates && data.masterCandidates.length != this.peerData.masterCandidates.length) { 
                //add all new candidates
                data.masterCandidates.filter(x => !this.peerData.masterCandidates.some(({ candidate: candidate }) => candidate === x.candidate)).forEach(candidate => {
                    this.peer.connection.addIceCandidate(candidate);
                    console.log("slave: Added new host candidate!");
                });
                this.peerData.masterCandidates = data.masterCandidates;
            }
        });
    }

    destory() {
        this.peerDocSubscription.unsubscribe();
        this.peer.destory();
    }
}