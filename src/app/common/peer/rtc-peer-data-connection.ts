import { AngularFirestoreDocument } from "@angular/fire/compat/firestore";
import { Subject, Subscription } from "rxjs";
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { DataChannelEvent } from "./data-channel-event";
import { EventType } from "./event-type";
import { RTCPeer } from "./rtc-peer";
import { UserBase } from "../user/user";
import { OG } from "../opengoal/og";
import { UserPositionDataTimestamp } from "../playback/position-data";

export class RTCPeerDataConnection {

    connection: RTCPeerConnection;
    dataChannelToPeer: RTCDataChannel;
    positionChannelToPeer: RTCDataChannel;
    hasConnected: boolean = false;

    self: UserBase;
    isMaster: boolean;
    isBeingDestroyed: boolean = false;
    usesServerCommunication: boolean = false;
    private lobbyDoc: AngularFirestoreDocument<Lobby>;
    private serverComSubscriptions: Subscription;


    constructor(eventChannel: Subject<DataChannelEvent>, positionChannel: Subject<UserPositionDataTimestamp> | null, self: UserBase, peer: UserBase, lobbyDoc: AngularFirestoreDocument<Lobby>, creatorIsMaster: boolean, connectionLog: string[] | null = null) {
        this.connection = new RTCPeerConnection({
            iceServers: [
              { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
            ],
            iceCandidatePoolSize: 10,
        });
        this.lobbyDoc = lobbyDoc;
        this.self = self;
        this.isMaster = creatorIsMaster;

        const dataChannelId = "dc-" + (this.isMaster ? peer.id : self.id);
        const positionChannelId = "pos-" + (this.isMaster ? peer.id : self.id);
        this.dataChannelToPeer = this.connection.createDataChannel(dataChannelId);
        
        if (positionChannel)
            this.positionChannelToPeer = this.connection.createDataChannel(positionChannelId, {ordered: false});
        
        console.log("Created data channels for id: ", this.isMaster ? peer.id : self.id);
        if (connectionLog)
            connectionLog.push("Created peer data channel");

        //setup local peer data listeners
        this.dataChannelToPeer.onopen = () => {
            if (connectionLog) {
                connectionLog.push("Peer data channel connected!");
                connectionLog.push("Waiting for data channel from host...");
            }
            console.log("data channel open");
            eventChannel.next(new DataChannelEvent(self.id, EventType.Connect, peer));
        }
        this.dataChannelToPeer.onclose = () => {
            console.log("data channel closed");
            eventChannel.next(new DataChannelEvent(self.id, EventType.Disconnect, peer));
        }

        if (positionChannel) {
            this.positionChannelToPeer.onopen = () => {
                if (connectionLog) {
                    connectionLog.push("Peer position channel connected!");
                    connectionLog.push("Waiting for position channel from host...");
                }
                console.log("position channel open");
                eventChannel.next(new DataChannelEvent(self.id, EventType.PositionChannelOpen, null));
            }
            this.positionChannelToPeer.onclose = () => {
                console.log("position channel closed");
                eventChannel.next(new DataChannelEvent(self.id, EventType.PositionChannelClosed, null));
            }
        }
        
        //setup remote peer data listeners
        this.connection.ondatachannel = ((dc) => {
            if (connectionLog)
                connectionLog.push("Host data channel connected!");

            const channel = dc.channel;
            console.log('%cGot data channel', 'color: #00ff00', dc);

            if (this.isMaster) {
                //!TODO: seems safe to delete instantly but I'm not taking any chances before I know for certain
                setTimeout(() => {
                    if (this.isBeingDestroyed) return;
                    lobbyDoc.collection(CollectionName.peerConnections).doc<RTCPeer>(peer.id).delete();
                }, 1000);
            }
            
            if (channel.label === dataChannelId) {
                this.hasConnected = true;

                channel.onmessage = (event) => {
                    eventChannel.next(JSON.parse(event.data));
                }
            }
            else if (channel.label === positionChannelId && positionChannel) {
                OG.runCommand("(set! (-> *multiplayer-info* players 1 username) \"" + peer.name + "\")");
                OG.runCommand("(set! (-> *multiplayer-info* players 1 mp_state) (mp-tgt-state mp-tgt-connected))");
                OG.runCommand("(set! (-> *self-player-info* color) (tgt-color normal))");
                channel.onmessage = (target) => {
                    positionChannel.next(JSON.parse(target.data));
                }
            }
        });

        //check if user never connected -> if so assume stuck or leftover user data from improper disconnect
        if (this.isMaster) {
            setTimeout(() => {
                if (this.isBeingDestroyed) return;
                if (!this.hasConnected) {
                    if (connectionLog)
                        connectionLog.push("Unable to establish connection...");
                    console.log("kicking: ", self.name);
                    eventChannel.next(new DataChannelEvent(self.id, EventType.Kick, self.id));
                    lobbyDoc.collection(CollectionName.peerConnections).doc<RTCPeer>(peer.id).delete();
                }
            }, 8000);
        }

        //suggest client server communcation if no peer to peer was established
        setTimeout(() => {
            if (this.isBeingDestroyed) return;
            if (!this.hasConnected && !this.serverComSubscriptions) {
                if (connectionLog) {
                    connectionLog.push("Unable to establish connection...");
                    connectionLog.push("Creating client to server fall back offer");
                }
                console.log("%cCreating client server communication channel", "color: #FFAC1C");
                if (this.isMaster)
                    this.setupServerCommunicationEventSubscription(peer, eventChannel);
                else
                    this.setupServerCommunicationEventSubscription(new UserBase("host", peer.name), eventChannel);
                if (connectionLog)
                    connectionLog.push("Waiting for response from host...");
            }
            
        }, 5000);
    }

    setupServerCommunicationEventSubscription(target: UserBase, eventChannel: Subject<DataChannelEvent>) {
        console.log("listening on server event at: ", target.id);
        if (this.serverComSubscriptions) this.serverComSubscriptions.unsubscribe();
        this.serverComSubscriptions = this.lobbyDoc.collection(CollectionName.serverEventCommuncation).doc<DataChannelEvent>(target.id).valueChanges().subscribe(event => {
            
            //assume reconnect where peer to peer might work due to new host
            if (event === undefined && this.isMaster) {
                eventChannel.next(new DataChannelEvent(target.id, EventType.Disconnect, target)); //fake user disconnect
            }

            if (!this.hasConnected && event?.type === EventType.Connect)
                this.onServerCommunicationEstablished(target);

            if (!this.hasConnected || (event?.userId === this.self.id && (event.type !== EventType.Connect && event.type !== EventType.Disconnect)))
                return;

            if (event && event.userId) 
                eventChannel.next(event);
        });
        console.log("event: writing to doc " + this.isMaster ? "host" : this.self.id + " event: ", new DataChannelEvent(this.self.id, EventType.Connect, this.self))
        this.lobbyDoc.collection(CollectionName.serverEventCommuncation).doc<DataChannelEvent>(this.isMaster ? "host" : this.self.id).set(JSON.parse(JSON.stringify(new DataChannelEvent(this.self.id, EventType.Connect, this.self))));
    }

    onServerCommunicationEstablished(target: UserBase) {
        this.hasConnected = true;
        this.usesServerCommunication = true;
        if (this.isMaster)
            this.lobbyDoc.collection(CollectionName.serverEventCommuncation).doc<DataChannelEvent>("host").set(JSON.parse(JSON.stringify(new DataChannelEvent(target.id, EventType.Connect, target))));
    }

    sendEvent(event: DataChannelEvent) {
        if (this.dataChannelToPeer?.readyState !== "open" && !this.usesServerCommunication) return;
        if (!this.usesServerCommunication)
            this.dataChannelToPeer.send(JSON.stringify(event));
        else {
            this.lobbyDoc.collection(CollectionName.serverEventCommuncation).doc<DataChannelEvent>(this.isMaster ? "host" : event.userId).set(JSON.parse(JSON.stringify(event)));
        }
    }

    sendPosition(target: UserPositionDataTimestamp) {
        if (this.positionChannelToPeer?.readyState === "open" && !this.usesServerCommunication)
            this.positionChannelToPeer.send(JSON.stringify(target));
    }

    destroy() {
        this.isBeingDestroyed = true;
        if (this.serverComSubscriptions) {
            this.lobbyDoc.collection(CollectionName.serverEventCommuncation).doc<DataChannelEvent>(this.isMaster ? "host" : this.self.id).set(JSON.parse(JSON.stringify(new DataChannelEvent(this.self.id, EventType.Disconnect, this.self))));
            this.serverComSubscriptions.unsubscribe();
        }
        if (this.dataChannelToPeer) this.dataChannelToPeer.close();
        if (this.positionChannelToPeer) {
            this.positionChannelToPeer.close();
        } 
        if (this.connection) this.connection.close();
    }

}