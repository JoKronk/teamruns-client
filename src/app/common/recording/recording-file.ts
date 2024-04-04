import { RunData } from "../run/run-data";
import { RecordingBase } from "./recording-base";
import { RecordingPositionData } from "./recording-position-data";

export class RecordingFile {
    version: string;
    runData: RunData | undefined;
    recordings: RecordingBase[] = [];

    constructor(version: string, recordings: RecordingBase[], runData: RunData | undefined = undefined) {
        this.version = version;
        this.runData = runData;

        recordings.forEach(recording => {
            this.recordings.push(RecordingBase.recreateFromDerivedClass(recording));
        });
    }
}



//kept for a while in case migration is needed
export class OldRecordingFileStructure {
    version: string;
    displayName: string;
    playback: RecordingPositionData[] = [];

    constructor (version: string, playback: RecordingPositionData[], displayName?: string) {
        this.version = version;
        this.playback = playback;
        this.displayName = displayName ?? "Unknown";
    }
}