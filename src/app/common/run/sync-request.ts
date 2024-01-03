export class SyncRequest {
    userId: string;
    reason: SyncRequestReason;
    
    constructor(userId: string, reason: SyncRequestReason) {
        this.userId = userId;
        this.reason = reason;
    }
}

export enum SyncRequestReason {
    InitConnect,
    Desync
}