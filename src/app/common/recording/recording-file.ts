import { RecordingPositionData } from "../socket/position-data";
import { Recording } from "./recording";

export class RecordingFile {
    version: string;
    displayName: string;
    playback: RecordingPositionData[] = [];

    constructor (version: string, playback: RecordingPositionData[], displayName?: string) {
        this.version = version;
        this.playback = playback;
        this.displayName = displayName ?? "Unknown";
    }
}

export class DbRecordingFile extends RecordingFile {
    userId: string;

    constructor(version: string, recording: Recording, displayName?: string) {
        recording.formatPlayback();
        super(version, recording.playback, displayName);
        this.userId = recording.userId;
    }
}