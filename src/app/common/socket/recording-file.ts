import { RecordingPositionData } from "./position-data";

export class RecordingFile {
    version: string;
    playback: RecordingPositionData[] = [];

    constructor (version: string, playback: RecordingPositionData[]) {
        this.version = version;
        this.playback = playback;
    }
}

export class DbRecordingFile extends RecordingFile {
    userId: string;

    constructor(userId: string, version: string, playback: RecordingPositionData[]) {
        super(version, playback);
        this.userId = userId;
    }
}