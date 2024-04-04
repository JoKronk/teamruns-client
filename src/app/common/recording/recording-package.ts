import { Recording } from "./recording";

export class RecordingPackage {
    teamId: number;
    recordings: Recording[];

    constructor(teamId: number, recordings: Recording[]) {
        this.teamId = teamId;
        this.recordings = recordings;
    }
}