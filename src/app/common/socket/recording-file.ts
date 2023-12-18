import { RecordingPositionData } from "./position-data";

export class RecordingFile {
    version: string;
    playback: RecordingPositionData[] = [];

    constructor(version: string, playback: RecordingPositionData[]) {
        this.version = version;
        this.playback = playback;
    }
}