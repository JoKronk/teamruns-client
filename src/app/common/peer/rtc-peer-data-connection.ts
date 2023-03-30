import { AngularFirestoreDocument } from "@angular/fire/compat/firestore";
import { Subject, Subscription } from "rxjs";
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { DataChannelEvent } from "./data-channel-event";
import { EventType } from "./event-type";
import { RTCPeer } from "./rtc-peer";

export class RTCPeerDataConnection {

    connection: RTCPeerConnection;
    channelToPeer: RTCDataChannel;
    hasConnected: boolean = false;

    isMaster: boolean;
    usesServerCommunication: boolean = false;
    private connectionUserId: string; //connection user id is self id for slave and peer id for master
    private lobbyDoc: AngularFirestoreDocument<Lobby>;
    private serverComSubscriptions: Subscription;


    constructor(eventChannel: Subject<DataChannelEvent>, selfId: string, peerId: string, lobbyDoc: AngularFirestoreDocument<Lobby>, creatorIsMaster: boolean) {
        this.connection = new RTCPeerConnection({
            iceServers: [
              { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
            ],
            iceCandidatePoolSize: 10,
        });
        this.lobbyDoc = lobbyDoc;
        this.isMaster = creatorIsMaster;
        this.connectionUserId = this.isMaster ? peerId : selfId;
        let chatId = "dc-" + this.connectionUserId;
        this.channelToPeer = this.connection.createDataChannel(chatId);
        console.log("Created data channel with id: ", chatId);

        //useful options: ordered false ignores making sure data is delivered in order
        //this.connection.createDataChannel("data", {ordered: false});

        //setup local peer data listeners
        this.channelToPeer.onopen = () => {
            console.log("data channel open");
            eventChannel.next(new DataChannelEvent(selfId, EventType.Connect, peerId));
        }
        this.channelToPeer.onclose = () => {
            console.log("data channel closed");
            eventChannel.next(new DataChannelEvent(selfId, EventType.Disconnect, peerId));
        }

        //setup remote peer data listeners
        this.connection.ondatachannel = ((dc) => {
            const channel = dc.channel;
            console.log('%cGot data channel', 'color: #00ff00');

            this.hasConnected = true;

            if (this.isMaster) {
                //!TODO: seems safe to delete instantly but I'm not taking any chances before I know for certain
                setTimeout(() => {
                    lobbyDoc.collection(CollectionName.peerConnections).doc<RTCPeer>(this.connectionUserId).delete();
                }, 1000);
            }
            channel.onmessage = (event) => {
                eventChannel.next(JSON.parse(event.data));
            }
        });

        //check if user never connected -> if so assume stuck or leftover user data from improper disconnect
        if (this.isMaster) {
            setTimeout(() => {
                if (!this.hasConnected) {
                    console.log("kicking: ", selfId);
                    eventChannel.next(new DataChannelEvent(selfId, EventType.Kick, selfId));
                    lobbyDoc.collection(CollectionName.peerConnections).doc<RTCPeer>(this.connectionUserId).delete();
                }
            }, 8000);
        }

        //suggest client server communcation if no peer to peer was established
        setTimeout(() => {
            if (!this.hasConnected) {
                console.log("%cCreating client server communication channel", "color: #FFAC1C");
                if (this.isMaster)
                    this.setupServerCommunicationEventSubscription("host", peerId, eventChannel);
                else
                    this.setupServerCommunicationEventSubscription(selfId, "host", eventChannel);
            }
            
        }, 5000);
    }

    setupServerCommunicationEventSubscription(userId: string, targetId: string, eventChannel: Subject<DataChannelEvent>) {
        console.log("listening on server event at: ", targetId)
        if (this.serverComSubscriptions) this.serverComSubscriptions.unsubscribe();
        this.serverComSubscriptions = this.lobbyDoc.collection(CollectionName.serverEventCommuncation).doc<DataChannelEvent>(targetId).valueChanges().subscribe(event => {
            console.log("event: got event from " + targetId + " :", event)
            if (!this.hasConnected)
                this.onServerCommunicationEstablished();

            if (event && event.userId) 
                eventChannel.next(event);
        });
        console.log("event: writing to doc " + userId + " event: ", new DataChannelEvent(userId, EventType.Connect, userId))
        this.lobbyDoc.collection(CollectionName.serverEventCommuncation).doc<DataChannelEvent>(userId).set(JSON.parse(JSON.stringify(new DataChannelEvent(userId, EventType.Connect, userId))));
    }

    onServerCommunicationEstablished() {
        this.hasConnected = true;
        this.usesServerCommunication = true;
    }

    sendEvent(event: DataChannelEvent) {
        if (this.channelToPeer.readyState !== "open" && !this.usesServerCommunication) return;
        if (!this.usesServerCommunication)
            this.channelToPeer.send(JSON.stringify(event));
        else {
            console.log("event: writing to doc " + (this.isMaster ? "host" : event.userId) + " event: ", event)
            this.lobbyDoc.collection(CollectionName.serverEventCommuncation).doc<DataChannelEvent>(this.isMaster ? "host" : this.connectionUserId).set(JSON.parse(JSON.stringify(event)));
        }
    }

    destroy() {
        if (this.serverComSubscriptions) {
            console.log("unsubscribing from client server com");
            this.serverComSubscriptions.unsubscribe();
        }
        if (this.channelToPeer) this.channelToPeer.close();
        if (this.connection) this.connection.close();
    }

}