import { EventType } from "./event-type";

export class DataChannelEvent {
    userId: string;
    type: EventType;
    value: any;

    constructor(userId: string, type: EventType, value: any) {
        this.userId = userId;
        this.type = type;
        this.value = value;
    }
}