import { PlayerBase } from "../player/player-base";
import { Subject } from "rxjs";
import { environment } from '../../../environments/environment';
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { DataChannelEvent } from "./data-channel-event";
import { EventType } from "./event-type";
import { UserPositionData } from "../socket/position-data";
import { deleteDoc, doc, DocumentReference, getDoc, onSnapshot, setDoc, Unsubscribe } from "@angular/fire/firestore";
import { FireStoreService } from "@app/services/fire-store.service";
import { RTCConnectionDecription } from "./rtc-connection-description";

export class RTCConnection {
    
    connectionDescription: RTCConnectionDecription;

    connection: RTCPeerConnection;
    eventChannelToPeer: RTCDataChannel;
    positionChannelToPeer: RTCDataChannel;
    hasConnected: boolean = false;
    connectionLog: string[] | null = null;
    
    private eventChannelId: string;
    private positionChannelId: string;

    private self: PlayerBase;
    peer: PlayerBase;
    private isHost: boolean;
    private hasPushedIceCandidates = false;
    private isBeingDestroyed: boolean = false;

    peerDocSubscription: Unsubscribe | null = null;


    constructor(public eventChannel: Subject<DataChannelEvent>, public positionChannel: Subject<UserPositionData> | null, public lobbyRef: DocumentReference<Lobby>, self: PlayerBase, peer: PlayerBase, isHost: boolean, connectionDescription: RTCConnectionDecription | null = null) {

        if (connectionDescription == null)
        this.connectionDescription = new RTCConnectionDecription(isHost ? peer : self);
        else
            this.connectionDescription = RTCConnectionDecription.copy(connectionDescription);

        this.self = self;
        this.peer = peer;
        this.isHost = isHost;

        //preliminary setup
        if (!this.isHost) {
             this.connectionLog = ["Setting up connection..."];
            this.checkDeleteOldPeer();
        }
        else
            this.logProgress("Got new user!", ("Host: Got new user " + this.peer.user.name + " with " + this.connectionDescription.peerCandidates.length + " candidates. Starting setup!"));



        //initial setup for connection
        this.setupIceServersForConnection();
        this.createDataChannelsForConnection(this.isHost ? this.peer.user.id : this.self.user.id, positionChannel !== null);


        //setup listeners
        this.setupEventChannelListener();
        if (positionChannel) 
            this.setupPositionChannelListener();
        this.setupConnectionListener();

        this.setupIceCandidatesListener();


        //start connection establishment process
        if (!this.isHost) {
            this.createOffer();
            this.setupAnswerListener();
        }
        else
            this.createAnswer();
        

        //check if user never connected -> if so assume stuck or blocked somehow by leftover user data from improper disconnect
        if (this.isHost) {
            setTimeout(() => {
                this.checkKickOnConnectionFailure();
            }, 8000);
        }
    }

    private getPeerDoc(): DocumentReference<RTCConnectionDecription> {
        if (this.isHost)
            return doc(this.lobbyRef, CollectionName.peerConnections, this.peer.user.id).withConverter(FireStoreService.convert<RTCConnectionDecription>())
        else
            return doc(this.lobbyRef, CollectionName.peerConnections, this.self.user.id).withConverter(FireStoreService.convert<RTCConnectionDecription>())
    }
    
    logProgress(log: string, customConsoleLog: string | any[] | null = null) {
        if (this.connectionLog)
            this.connectionLog.push(log);
        
        if (customConsoleLog !== undefined) {
            if (Array.isArray(customConsoleLog))
                console.log(...customConsoleLog);
            else
                console.log(customConsoleLog ?? log);
        }
    }

    //!TODO: Do more with this
    private logError(msg: string, error: any) {
        console.log(msg, error);
    }

    // --- SETUP FUNCTIONS ---

    private async checkDeleteOldPeer() {
        const peerSnap = await getDoc(this.getPeerDoc());
        if (!peerSnap.exists()) 
            return;
        
        this.logProgress("Found previous connection, deleting!", "Peer: Found previous connection, deleting!")
        await deleteDoc(this.getPeerDoc());
    }

    private setupIceServersForConnection() {
        let peerIceServers: RTCIceServer[] = [environment.stunServers, environment.turnIceServers];

        this.connection = new RTCPeerConnection({
            iceServers: peerIceServers,
            iceCandidatePoolSize: 10,
        });
        this.logProgress("ICE servers configured");
    }

    private createDataChannelsForConnection(peerId: string, hasPositionChannel: boolean) {
        this.eventChannelId = "dc-" + peerId;
        this.positionChannelId = "pos-" + peerId;
        this.eventChannelToPeer = this.connection.createDataChannel(this.eventChannelId);

        if (hasPositionChannel)
        this.positionChannelToPeer = this.connection.createDataChannel(this.positionChannelId, {ordered: false});
        
        this.logProgress("Peer event channels created", ["Created event channels for id: ", peerId]);
    }

    private setupEventChannelListener() {
        this.eventChannelToPeer.onopen = () => {
            this.logProgress("Peer event channel connected!");
            this.eventChannel.next(new DataChannelEvent(this.self.user.id, EventType.Connect, this.peer));
        }
        this.eventChannelToPeer.onclose = () => {
            this.logProgress("Peer event channel closed!");
            this.eventChannel.next(new DataChannelEvent(this.self.user.id, EventType.Disconnect, this.peer.user));
        }
        this.eventChannelToPeer.onerror = (error) => {
            this.logError("Event channel error", error);
        }
        this.logProgress("Event channel listener created");
        this.logProgress("Waiting for event channel connection with host...", undefined);
    }

    private setupPositionChannelListener() {
        this.positionChannelToPeer.onopen = () => {
            this.logProgress("Peer position channel connected!");
            this.eventChannel.next(new DataChannelEvent(this.self.user.id, EventType.PositionChannelOpen, null));
        }
        this.positionChannelToPeer.onclose = () => {
            this.logProgress("Peer position channel closed!");
            this.eventChannel.next(new DataChannelEvent(this.self.user.id, EventType.PositionChannelClosed, null));
        }
        this.positionChannelToPeer.onerror = (error) => {
            this.logError("Position channel error", error);
        }
        this.logProgress("Position channel listener created");
        this.logProgress("Waiting for position channel connection with host...", undefined);
    }

    private setupIceCandidatesListener() {
        this.connection.onicecandidate = (event) => {
            //on cadidate
            if (event.candidate) {
                if (this.isHost)
                    this.connectionDescription.hostCandidates.push(event.candidate);
                else
                    this.connectionDescription.peerCandidates.push(event.candidate);
                this.logProgress("Got ICE candidate");

                this.hasPushedIceCandidates = false;
            }
            //on done fetching candidates
            else {
                this.logProgress("ICE candidate collection completed!");
                this.pushIceCandidates();
            }

        };
        this.logProgress("ICE candidate lisenter created");
    }

    private pushIceCandidates() {
        if (this.isBeingDestroyed || this.hasPushedIceCandidates) return;
        
        this.hasPushedIceCandidates = true;

        if (this.isHost) {
            setDoc(this.getPeerDoc(), JSON.parse(JSON.stringify(RTCConnectionDecription.copy(this.connectionDescription)))).then(() => { //description gets poluted by peer due to it being binded by reference
                this.logProgress("SDP answer given to: " + this.peer.user.name);
            });
        }
        else {
            setDoc(this.getPeerDoc(), JSON.parse(JSON.stringify(RTCConnectionDecription.copy(this.connectionDescription)))).then(() => {
                this.logProgress("SDP offer given!", "Peer: SDP offer given!");
            });
        }
    }

    private setupConnectionListener() {
        this.connection.ondatachannel = ((dc) => {
            const channel = dc.channel;

            if (this.isHost) {
                //should be safe to delete instantly but we're playing it safe
                setTimeout(() => {
                    if (this.isBeingDestroyed) return;
                    deleteDoc(this.getPeerDoc());
                }, 1000);
            }

            //event channel data handling
            if (channel.label === this.eventChannelId) {
                this.hasConnected = true;

                channel.onmessage = (event) => {
                    this.eventChannel.next(JSON.parse(event.data));
                }
            }

            //position channel data handling
            else if (channel.label === this.positionChannelId && this.positionChannel) {
                channel.onmessage = (target) => {
                    this.positionChannel!.next(JSON.parse(target.data));
                }
            }
        });
    }

    private async createOffer() {
        //create session description offer for connecting client, this automatically should start the ice candidates fetching
        this.connectionDescription.peerOffer = await this.connection.createOffer();
        this.logProgress("Creating SDP offer", "Peer: Creating SDP offer");
        await this.connection.setLocalDescription(this.connectionDescription.peerOffer);
        this.logProgress("Starting ICE candidates collecting process");

        this.waitCheckIceCandidatesPush();
    }

    private async createAnswer() {

        await this.connection.setRemoteDescription(new RTCSessionDescription(this.connectionDescription.peerOffer));
        this.connectionDescription.hostAnswer = await this.connection.createAnswer();
        this.logProgress("Creating SDP answer", "Host: Creating SDP answer");
        await this.connection.setLocalDescription(this.connectionDescription.hostAnswer);
        this.logProgress("Starting ICE candidates collecting process");

        this.connectionDescription.peerCandidates.forEach(candidate => {
            this.connection.addIceCandidate(candidate);
        });

        this.waitCheckIceCandidatesPush();
    }

    private waitCheckIceCandidatesPush() {
        setTimeout(() => {
            this.pushIceCandidates();
        }, 500);
    }

    private setupAnswerListener() {
        
        //listen for host connection response
        this.peerDocSubscription = onSnapshot(this.getPeerDoc(), (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;
            const data = snapshot.data();
            if (!data) return;

            //check host description creation
            if (data.hostAnswer && (!this.connection.currentRemoteDescription || this.connectionDescription.hostAnswer?.sdp !== data.hostAnswer.sdp)) {
                this.connectionDescription.hostAnswer = data.hostAnswer;
                this.logProgress("Got SDP answer from host!");
                this.connection.setRemoteDescription(new RTCSessionDescription(this.connectionDescription.hostAnswer));
            }

            //check ice candidate add
            if (data.hostAnswer && data.hostCandidates.length != this.connectionDescription.hostCandidates.length) { 
                //add all new candidates
                data.hostCandidates.filter(x => !this.connectionDescription.hostCandidates.some(({ candidate }) => candidate === x.candidate)).forEach(candidate => {
                    this.connection.addIceCandidate(candidate);
                    this.logProgress("Added new host candidate!");
                });
                this.connectionDescription.hostCandidates = data.hostCandidates;
            }
        });
    }

    addPeerCandidates(connectionDescription: RTCConnectionDecription) {
        connectionDescription.peerCandidates.filter(x => !this.connectionDescription.peerCandidates.some(({ candidate }) => candidate === x.candidate)).forEach(candidate => {
            this.connection.addIceCandidate(candidate);
            this.logProgress("Added new peer candidate!");
        });
        this.connectionDescription.peerCandidates = connectionDescription.peerCandidates;
    }

    private checkKickOnConnectionFailure() {
        if (this.isBeingDestroyed || this.hasConnected) return;

        this.logProgress("Unable to establish connection...", ["kicking: ", self.name]);
        this.eventChannel.next(new DataChannelEvent(this.self.user.id, EventType.Kick, this.self.user.id)); //send a fabricated kick request for self from peer
        deleteDoc(this.getPeerDoc());
        
    }


    //--- POST SETUP FUNCTIONS ---

    sendEvent(event: DataChannelEvent) {
        if (this.eventChannelToPeer?.readyState !== "open") return;
        //the timerSubject thing ensures we avoid circular loops when parsing objects that include the timer (and timerSubject)
        this.eventChannelToPeer.send(JSON.stringify(event, (key, value) => { return key === "timerSubject" ? undefined : value; }));
    }

    sendPosition(target: UserPositionData) {
        if (this.positionChannelToPeer?.readyState === "open")
            this.positionChannelToPeer.send(JSON.stringify(target));
    }

    destroy() {
        this.isBeingDestroyed = true;
        if (this.peerDocSubscription) this.peerDocSubscription();
        if (this.eventChannelToPeer) this.eventChannelToPeer.close();
        if (this.positionChannelToPeer) this.positionChannelToPeer.close();
        if (this.connection) this.connection.close();
    }
}