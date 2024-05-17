import { AngularFirestoreDocument } from "@angular/fire/compat/firestore";
import { Subject } from "rxjs";
import { environment } from '../../../environments/environment';
import { CollectionName } from "../firestore/collection-name";
import { Lobby } from "../firestore/lobby";
import { DataChannelEvent } from "./data-channel-event";
import { EventType } from "./event-type";
import { RTCPeer } from "./rtc-peer";
import { UserBase } from "../user/user";
import { UserPositionData } from "../socket/position-data";
import { PlayerBase } from "../player/player-base";

export class RTCPeerDataConnection {

    connection: RTCPeerConnection;
    dataChannelToPeer: RTCDataChannel;
    positionChannelToPeer: RTCDataChannel;
    hasConnected: boolean = false;

    self: UserBase;
    isMaster: boolean;
    isBeingDestroyed: boolean = false;
    private lobbyDoc: AngularFirestoreDocument<Lobby>;


    constructor(eventChannel: Subject<DataChannelEvent>, positionChannel: Subject<UserPositionData> | null, self: UserBase, peer: PlayerBase, lobbyDoc: AngularFirestoreDocument<Lobby>, creatorIsMaster: boolean, connectionLog: string[] | null = null) {
        let peerIceServers: RTCIceServer[] = [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }];
        peerIceServers.push(environment.turnIceServer);

        this.connection = new RTCPeerConnection({
            iceServers: peerIceServers,
            iceCandidatePoolSize: 10,
        });
        this.lobbyDoc = lobbyDoc;
        this.self = self;
        this.isMaster = creatorIsMaster;

        const dataChannelId = "dc-" + (this.isMaster ? peer.user.id : self.id);
        const positionChannelId = "pos-" + (this.isMaster ? peer.user.id : self.id);
        this.dataChannelToPeer = this.connection.createDataChannel(dataChannelId);
        
        if (positionChannel)
            this.positionChannelToPeer = this.connection.createDataChannel(positionChannelId, {ordered: false});
        
        console.log("Created data channels for id: ", this.isMaster ? peer.user.id : self.id);
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
            eventChannel.next(new DataChannelEvent(self.id, EventType.Disconnect, peer.user));
        }
        this.dataChannelToPeer.onerror = (error) => {
            console.log(error);
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
                    lobbyDoc.collection(CollectionName.peerConnections).doc<RTCPeer>(peer.user.id).delete();
                }, 1000);
            }
            
            if (channel.label === dataChannelId) {
                this.hasConnected = true;

                channel.onmessage = (event) => {
                    eventChannel.next(JSON.parse(event.data));
                }
            }
            else if (channel.label === positionChannelId && positionChannel) {
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
                    lobbyDoc.collection(CollectionName.peerConnections).doc<RTCPeer>(peer.user.id).delete();
                }
            }, 8000);
        }
    }

    sendEvent(event: DataChannelEvent) {
        if (this.dataChannelToPeer?.readyState !== "open") return;
        //the timerSubject thing ensures we avoid circular loops when parsing objects that include the timer (and timerSubject)
        this.dataChannelToPeer.send(JSON.stringify(event, (key, value) => { return key === "timerSubject" ? undefined : value; }));
    }

    sendPosition(target: UserPositionData) {
        if (this.positionChannelToPeer?.readyState === "open")
            this.positionChannelToPeer.send(JSON.stringify(target));
    }

    destroy() {
        this.isBeingDestroyed = true;
        if (this.dataChannelToPeer) this.dataChannelToPeer.close();
        if (this.positionChannelToPeer) {
            this.positionChannelToPeer.close();
        } 
        if (this.connection) this.connection.close();
    }

}