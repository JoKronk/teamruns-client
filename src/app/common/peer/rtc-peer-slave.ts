import { Subject } from "rxjs";
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { UserBase } from "../user/user";
import { DataChannelEvent } from "./data-channel-event";
import { RTCPeer } from "./rtc-peer";
import { RTCPeerDataConnection } from "./rtc-peer-data-connection";
import { UserPositionData } from "../socket/position-data";
import { PlayerBase } from "../player/player-base";
import { deleteDoc, doc, DocumentReference, getDoc, onSnapshot, setDoc, Unsubscribe } from "@angular/fire/firestore";
import { FireStoreService } from "@app/services/fire-store.service";

export class RTCPeerSlave {
    private currentMasterSdp: string | undefined;

    peerData: RTCPeer;
    peer: RTCPeerDataConnection;
    peerDoc: DocumentReference<RTCPeer>;
    peerDocUnsubscribe: Unsubscribe;
    
    hostId: string;
    connectionLogs: string[] = ["Setting up connection..."];
    isBeingDestroyed: boolean = false;
    eventChannel: Subject<DataChannelEvent> = new Subject();
    positionChannel: Subject<UserPositionData> | null = null;

    constructor(player: PlayerBase, lobbyRef: DocumentReference<Lobby>, host: PlayerBase) {
        this.peerDoc = doc(lobbyRef, CollectionName.peerConnections, player.user.id).withConverter(FireStoreService.convert<RTCPeer>());
        this.peerData = new RTCPeer(player);
        this.hostId = host.user.id;

        this.positionChannel = new Subject();

        this.preCreationCleanup(player.user, lobbyRef, host);
    }

    private async preCreationCleanup(user: UserBase, lobbyRef: DocumentReference<Lobby>, host: PlayerBase) {
        
        //delete old peer connection if exists
        const peerSnap = await getDoc(this.peerDoc);
        if (peerSnap.exists()) {
            this.connectionLogs.push("Detected previous connection, deleting!");
            console.log("slave: Peer connection exists from before, deleting!");
            await deleteDoc(this.peerDoc);
            this.createPeerConnection(lobbyRef, user, host);
        }
        else
            this.createPeerConnection(lobbyRef, user, host);
    }

    private async createPeerConnection(lobbyRef: DocumentReference<Lobby>, user: UserBase, host: PlayerBase) {
        this.peer = new RTCPeerDataConnection(this.eventChannel, this.positionChannel, user, host, lobbyRef, false, this.connectionLogs);

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
            setDoc(this.peerDoc, JSON.parse(JSON.stringify(this.peerData)));
            this.connectionLogs.push("Created connection offer!");
            console.log("slave: Created slave offer!");
        }, 500);

        
        //listen for master connection response
        this.peerDocUnsubscribe = onSnapshot(this.peerDoc, (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;
            const data = snapshot.data();
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
        if (this.peerDocUnsubscribe)
            this.peerDocUnsubscribe();
        this.peer.destroy();
    }
}