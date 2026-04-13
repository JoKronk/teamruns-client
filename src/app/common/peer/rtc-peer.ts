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
import { UserBase } from "../user/user";
import { RTCConnectionDecription } from "./rtc-connection-description";
import { PlayerType } from "../player/player-type";

export class RTCPeer {
    
    connectionDescription: RTCConnectionDecription;

    connection: RTCPeerConnection;
    eventChannelToPeer: RTCDataChannel;
    positionChannelToPeer: RTCDataChannel;
    hasConnected: boolean = false;
    connectionLogs: string[] | null = null;

    private connectionLog: string[] | null = null;
    private eventChannelId: string;
    private positionChannelId: string;

    private self: UserBase;
    peer: PlayerBase;
    private isHost: boolean;
    private hasPushedIceCandidates = false;
    private isBeingDestroyed: boolean = false;

    peerDocSubscription: Unsubscribe | null = null;


    constructor(public eventChannel: Subject<DataChannelEvent>, public positionChannel: Subject<UserPositionData> | null, public lobbyRef: DocumentReference<Lobby>, self: UserBase, peer: PlayerBase, isHost: boolean, connectionDescription: RTCConnectionDecription | null = null) {
        console.log("is peer", peer instanceof PlayerBase)
        if (connectionDescription == null)
        this.connectionDescription = new RTCConnectionDecription(isHost ? new PlayerBase(self, PlayerType.User) : peer); //!TODO: FIX SO THAT WE KNOW IF HOST IS USER OR GUEST USER
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
            this.logProgress("Got new user!", ("Host: Got new user " + this.peer.user.name + " with " + this.connectionDescription.slaveCandidates.length + " candidates. Starting setup!"));



        //initial creations for connection
        this.setupIceServersForConnection();
        this.createDataChannelsForConnection(this.isHost ? this.peer.user.id : self.id, positionChannel !== null);

        //setup listeners
        this.setupEventChannelListener();
        if (positionChannel)
            this.setupPositionChannelListener();

        this.setupIceCandidatesListener();
        this.setupConnectionListener();

        //start connection establishment process
        if (!this.isHost) {
            this.createOffer();
            this.setupAnswerListener();
        }
        else
            this.createAnswer();
        

        //check if user never connected -> if so assume stuck or blocked by leftover user data from improper disconnect
        if (this.isHost) {
            setTimeout(() => {
                this.checkKickOnConnectionFailure();
            }, 8000);
        }
    }

    getPeerDoc(): DocumentReference<RTCConnectionDecription> {
        if (this.isHost)
            return doc(this.lobbyRef, CollectionName.peerConnections, this.peer.user.id).withConverter(FireStoreService.convert<RTCConnectionDecription>())
        else
            return doc(this.lobbyRef, CollectionName.peerConnections, this.self.id).withConverter(FireStoreService.convert<RTCConnectionDecription>())
    }
    
    logProgress(log: string, customConsoleLog: string | any[] | null = null) {
        if (this.connectionLog)
            this.connectionLog.push(log);
        
        if (customConsoleLog !== undefined) {
            console.log(customConsoleLog ?? log);
        }
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
        let peerIceServers: RTCIceServer[] = [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }];
        peerIceServers.push(environment.turnIceServer);

        this.connection = new RTCPeerConnection({
            iceServers: peerIceServers,
            iceCandidatePoolSize: 10,
        });
        this.logProgress("Ice connections configured");
    }

    private createDataChannelsForConnection(connectionId: string, hasPositionChannel: boolean) {
        this.eventChannelId = "dc-" + connectionId;
        this.positionChannelId = "pos-" + connectionId;
        this.eventChannelToPeer = this.connection.createDataChannel(this.eventChannelId);
        
        if (hasPositionChannel)
            this.positionChannelToPeer = this.connection.createDataChannel(this.positionChannelId, {ordered: false});
        
        this.logProgress("Peer event channels created", ["Created event channels for id: ", connectionId]);
    }

    private setupEventChannelListener() {
        this.eventChannelToPeer.onopen = () => {
            this.logProgress("Peer event channel connected!");
            this.eventChannel.next(new DataChannelEvent(this.self.id, EventType.Connect, this.peer));
        }
        this.eventChannelToPeer.onclose = () => {
            this.logProgress("Peer event channel closed!");
            this.eventChannel.next(new DataChannelEvent(this.self.id, EventType.Disconnect, this.peer.user));
        }
        this.eventChannelToPeer.onerror = (error) => {
            console.log("Event channel error", error);
        }
        this.logProgress("Event channel listener created");
        this.logProgress("Waiting for event channel connection with host...", undefined);
    }

    private setupPositionChannelListener() {
        this.positionChannelToPeer.onopen = () => {
            this.logProgress("Peer position channel connected!");
            this.eventChannel.next(new DataChannelEvent(this.self.id, EventType.PositionChannelOpen, null));
        }
        this.positionChannelToPeer.onclose = () => {
            this.logProgress("Peer position channel closed!");
            this.eventChannel.next(new DataChannelEvent(this.self.id, EventType.PositionChannelClosed, null));
        }
        this.positionChannelToPeer.onerror = (error) => {
            console.log("Position channel error", error);
        }
        this.logProgress("Position channel listener created");
        this.logProgress("Waiting for position channel connection with host...", undefined);
    }

    private setupIceCandidatesListener() {
        this.connection.onicecandidate = (event) => {
            //on cadidate
            if (event.candidate) {
                if (this.isHost)
                    this.connectionDescription.masterCandidates.push(event.candidate);
                else
                    this.connectionDescription.slaveCandidates.push(event.candidate);
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
            setDoc(this.getPeerDoc(), JSON.parse(JSON.stringify(RTCConnectionDecription.copy(this.connectionDescription)))).then(() => { //peer gets poluted by slave due to it being binded by reference
                this.logProgress("SDP answer given to: " + this.peer.user.name);
            });
        }
        else {
            setDoc(this.getPeerDoc(), JSON.parse(JSON.stringify(this.connectionDescription))).then(() => {
                this.logProgress("SDP offer given!", "Peer: SDP offer given!");
            });
        }
    }

    private setupConnectionListener() {
        //setup remote peer data listeners
        this.connection.ondatachannel = ((dc) => {
            this.logProgress("Host data channel connected!", ['%cGot data channel', 'color: #00ff00', dc])

            const channel = dc.channel;

            if (this.isHost) {
                //should be safe to delete instantly but we playing it safe
                setTimeout(() => {
                    if (this.isBeingDestroyed) return;
                    deleteDoc(doc(this.lobbyRef, CollectionName.peerConnections, this.peer.user.id));
                }, 1000);
            }

            //define data channel data handling
            if (channel.label === this.eventChannelId) {
                this.hasConnected = true;

                channel.onmessage = (event) => {
                    this.eventChannel.next(JSON.parse(event.data));
                }
            }

            //define position channel data handling
            else if (channel.label === this.positionChannelId && this.positionChannel) {
                channel.onmessage = (target) => {
                    this.positionChannel!.next(JSON.parse(target.data));
                }
            }
        });
    }

    private async createOffer() {
        //create session description offer for connecting client, this automatically should start the ice candidates fetching
        this.connectionDescription.slaveDescription = await this.connection.createOffer();
        this.logProgress("Creating SDP offer", "Peer: Creating SDP offer");
        await this.connection.setLocalDescription(this.connectionDescription.slaveDescription);
        this.logProgress("Starting ICE candidates collecting process");

        this.waitCheckIceCandidatesPush();
    }

    private async createAnswer() {

        await this.connection.setRemoteDescription(new RTCSessionDescription(this.connectionDescription.slaveDescription));
        this.connectionDescription.masterDescription = await this.connection.createAnswer();
        this.logProgress("Creating SDP answer", "Host: Creating SDP answer");
        await this.connection.setLocalDescription(this.connectionDescription.masterDescription);
        this.logProgress("Starting ICE candidates collecting process");

        this.connectionDescription.slaveCandidates.forEach(candidate => {
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
        
        //listen for master connection response
        this.peerDocSubscription = onSnapshot(this.getPeerDoc(), (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;
            const data = snapshot.data();
            if (!data) return;

            //check master description creation
            if (data.masterDescription && (!this.connection.currentRemoteDescription || this.connectionDescription.masterDescription?.sdp !== data.masterDescription.sdp)) {
                this.connectionDescription.masterDescription = data.masterDescription;
                this.logProgress("Got SDP answer from host!");
                this.connection.setRemoteDescription(new RTCSessionDescription(this.connectionDescription.masterDescription));
            }

            //check ice candidate add
            if (data.masterDescription && data.masterCandidates.length != this.connectionDescription.masterCandidates.length) { 
                //add all new candidates
                data.masterCandidates.filter(x => !this.connectionDescription.masterCandidates.some(({ candidate: candidate }) => candidate === x.candidate)).forEach(candidate => {
                    this.connection.addIceCandidate(candidate);
                    console.log("Peer: Added new host candidate!");
                });
                this.connectionDescription.masterCandidates = data.masterCandidates;
            }
        });
    }

    addPeerCandidates(connectionDescription: RTCConnectionDecription) {
        connectionDescription.slaveCandidates.filter(x => !this.connectionDescription.slaveCandidates.some(({ candidate: candidate }) => candidate === x.candidate)).forEach(candidate => {
            this.connection.addIceCandidate(candidate);
            console.log("Host: Added new peer candidate!");
        });
        this.connectionDescription.slaveCandidates = connectionDescription.slaveCandidates;
    }

    private checkKickOnConnectionFailure() {
        if (this.isBeingDestroyed || this.hasConnected) return;

        this.logProgress("Unable to establish connection...", ["kicking: ", self.name]);
        this.eventChannel.next(new DataChannelEvent(this.self.id, EventType.Kick, this.self.id)); //send a fabricated kick request for self from peer
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