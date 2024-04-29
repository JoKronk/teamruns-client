import { RunData } from "../run/run-data";
import { RecordingBase } from "./recording-base";
import { RecordingPositionData } from "./recording-position-data";

export class RecordingFile {
    version: string;
    gameVersion: string;
    runData: RunData | undefined;
    recordings: RecordingBase[] = [];

    constructor(version: string, gameVersion: string, recordings: RecordingBase[], runData: RunData | undefined = undefined) {
        this.version = version;
        this.runData = runData;
        this.gameVersion = gameVersion;

        recordings.forEach((recording, i) => {
            if (!(recording instanceof RecordingBase))
                recordings[i] = Object.assign(new RecordingBase(recordings[i].username, recordings[i].playback), recording)
            
            recordings[i].optimizePlaybackSize();
            this.recordings.push(RecordingBase.recreateFromDerivedClass(recordings[i]));
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