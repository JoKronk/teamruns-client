import { Subject } from "rxjs";
import { DataChannelEvent } from "./data-channel-event";
import { EventType } from "./event-type";

export class RTCPeerDataConnection {

    connection: RTCPeerConnection;
    channelToPeer: RTCDataChannel;
    hasConnected: boolean = false;


    constructor(eventChannel: Subject<DataChannelEvent>, userId: string, createdInMaster: boolean) {
        this.connection = new RTCPeerConnection({
            iceServers: [
              { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
            ],
            iceCandidatePoolSize: 10,
        });
        let chatId = "dc-" + userId;
        this.channelToPeer = this.connection.createDataChannel(chatId);
        console.log("Created data channel with id: ", chatId);

        //useful options: ordered false ignores making sure data is delivered in order
        //this.connection.createDataChannel("data", {ordered: false});

        //setup local peer data listeners
        this.channelToPeer.onopen = () => {
            console.log("data channel open");
            eventChannel.next(new DataChannelEvent(userId, EventType.Connect, null));
        }
        this.channelToPeer.onclose = () => {
            console.log("data channel closed");
            eventChannel.next(new DataChannelEvent(userId, EventType.Disconnect, null));
        }

        //setup remote peer data listeners
        this.connection.ondatachannel = ((dc) => {
            const channel = dc.channel;
            console.log('%cGot data channel', 'color: #00ff00', channel);

            this.hasConnected = true;

            channel.onmessage = (event) => {
                eventChannel.next(JSON.parse(event.data));
            }
        });

        //check if user never connected -> if so assume stuck or leftover user data from improper disconnect
        if (createdInMaster) {
            setTimeout(() => {
                if (!this.hasConnected) {
                    console.log("kicking: ", userId);
                    eventChannel.next(new DataChannelEvent(userId, EventType.Disconnect, null));
                }
            }, 8000);
        }
    }

    sendEvent(event: DataChannelEvent) {
        if (this.channelToPeer.readyState !== "open") return;
        
        this.channelToPeer.send(JSON.stringify(event));
    }

    destory() {
        this.channelToPeer.close();
        this.connection.close();
    }

}