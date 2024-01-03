import { Run } from "./run";
import { SyncRequest, SyncRequestReason } from "./sync-request";

export class SyncResponse {
    userId: string | null;
    run: Run;
    
    constructor(request: SyncRequest, run: Run) {
        this.userId = request.reason === SyncRequestReason.InitConnect ? null : request.userId;
        this.run = run;
    }
}