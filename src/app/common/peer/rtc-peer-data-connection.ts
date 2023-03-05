import { Subject } from "rxjs";
import { DataChannelEvent } from "./data-channel-event";
import { EventType } from "./event-type";

export class RTCPeerDataConnection {

    connection: RTCPeerConnection;
    localDataChannel: RTCDataChannel;


    constructor(dataChannel: Subject<DataChannelEvent>, user: string) {
        this.connection = new RTCPeerConnection({
            iceServers: [
              { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
            ],
            iceCandidatePoolSize: 10,
        });
        let chatId = "dc-" + user;
        this.localDataChannel = this.connection.createDataChannel(chatId);
        console.log("Created data channel with id: ", chatId)

        //useful options: ordered false ignores making sure data is delivered in order
        //this.connection.createDataChannel("data", {ordered: false});

        //setup local peer data listeners
        this.localDataChannel.onopen = () => {
            console.log("data channel open");
            dataChannel.next(new DataChannelEvent(user, EventType.Connect, null));
        }
        this.localDataChannel.onclose = () => {
            console.log("data channel closed");
            dataChannel.next(new DataChannelEvent(user, EventType.Disconnect, null));
        }

        //setup remote peer data listeners
        this.connection.ondatachannel = ((dc) => {
            const channel = dc.channel;
            console.log('Got data channel', channel);

            channel.onmessage = (event) => {
                dataChannel.next(JSON.parse(event.data));
            }
        });
    }

    sendEvent(event: DataChannelEvent) {
        if (this.localDataChannel.readyState !== "open") return;
        
        this.localDataChannel.send(JSON.stringify(event));
    }

    destory() {
        this.localDataChannel.close();
        this.connection.close();
    }

}