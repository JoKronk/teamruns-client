import { MultiplayerState } from "../opengoal/multiplayer-state";
import { Recording } from "./recording";

export class RecordingPackage {
    teamId: number;
    recordings: Recording[];
    forceState: MultiplayerState | undefined;

    constructor(teamId: number, recordings: Recording[], setState: MultiplayerState | undefined = undefined) {
        this.teamId = teamId;
        this.recordings = recordings;
        this.forceState = setState;
    }
}