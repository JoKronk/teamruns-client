import { AngularFirestoreDocument } from "@angular/fire/compat/firestore";
import { Subject, Subscription } from "rxjs";
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { UserBase } from "../user/user";
import { DataChannelEvent } from "./data-channel-event";
import { RTCPeer } from "./rtc-peer";
import { RTCPeerDataConnection } from "./rtc-peer-data-connection";
import { UserPositionData } from "../socket/position-data";

export class RTCPeerSlave {
    private currentMasterSdp: string | undefined;

    peerData: RTCPeer;
    peer: RTCPeerDataConnection;
    peerDoc: AngularFirestoreDocument<RTCPeer>;
    peerDocSubscription: Subscription;
    
    hostId: string;
    connectionLogs: string[] = ["Setting up connection..."];
    isBeingDestroyed: boolean = false;
    eventChannel: Subject<DataChannelEvent> = new Subject();
    positionChannel: Subject<UserPositionData> | null = null;

    constructor(user: UserBase, doc: AngularFirestoreDocument<Lobby>, host: UserBase) {
        this.peerDoc = doc.collection<RTCPeer>(CollectionName.peerConnections).doc(user.id);
        this.peerData = new RTCPeer(user);
        this.hostId = host.id;

        this.positionChannel = new Subject();

        this.preCreationCleanup(user, doc, host);
    }

    private async preCreationCleanup(user: UserBase, lobbyDoc: AngularFirestoreDocument<Lobby>, host: UserBase) {
        //delete old server communication if exists
        if ((await lobbyDoc.collection(CollectionName.serverEventCommuncation).doc<DataChannelEvent>(user.id).ref.get()).exists) {
            this.connectionLogs.push("Detected previous server communication, deleting!");
            console.log("slave: Server communication exists from before, deleting!");
            await lobbyDoc.collection(CollectionName.serverEventCommuncation).doc<DataChannelEvent>(user.id).delete();
        }

        //delete old peer connection if exists
        let peer = await this.peerDoc.ref.get();
        if (peer.exists) {
            this.connectionLogs.push("Detected previous connection, deleting!");
            console.log("slave: Peer connection exists from before, deleting!");
            await this.peerDoc.delete();
            this.createPeerConnection(lobbyDoc, user, host);
        }
        else
            this.createPeerConnection(lobbyDoc, user, host);
    }

    private async createPeerConnection(lobbyDoc: AngularFirestoreDocument<Lobby>, user: UserBase, host: UserBase) {
        this.peer = new RTCPeerDataConnection(this.eventChannel, this.positionChannel, user, host, lobbyDoc, false, this.connectionLogs);

        //listen for slave candidates to be created, might need to be done before .createOffer() according to some unlisted documentation
        this.peer.connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.peerData.slaveCandidates.push(event.candidate);
                this.connectionLogs.push("Got ice candidate");
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
            if (this.isBeingDestroyed) return;
            this.peerDoc.set(JSON.parse(JSON.stringify(this.peerData)));
            this.connectionLogs.push("Created connection offer!");
            console.log("slave: Created slave offer!");
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
            //!TODO: this check will surely create some edge case bug in the future if candidates is bound to a max pool size and going above the set limit throws an error, 
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

    destroy() {
        this.isBeingDestroyed = true;
        if (this.peerDocSubscription)
            this.peerDocSubscription.unsubscribe();
        this.peer.destroy();
    }
}