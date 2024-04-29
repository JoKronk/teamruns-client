import { UserRecordingBase } from "../recording/user-recording";
import { RecordingFile } from "../recording/recording-file";
import { RunData } from "../run/run-data";

export class DbRecordingFile extends RecordingFile {
    pdId: string;
    override recordings: UserRecordingBase[] = [];


    constructor(version: string, gameVersion: string, recordings: UserRecordingBase[], pbId: string, runData: RunData) {
        super(version, gameVersion, [], runData);
        this.pdId = pbId;

        recordings.forEach(recording => {
            recording.optimizePlaybackSize();
            this.recordings.push(UserRecordingBase.recreateFromDerivedClass(recording));
        });
    }
}