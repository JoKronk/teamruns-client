import { EventType } from "./event-type";

export class DataChannelEvent {
    user: string;
    type: EventType;
    value: any;

    constructor(user: string, type: EventType, value: any) {
        this.user = user;
        this.type = type;
        this.value = value;
    }
}