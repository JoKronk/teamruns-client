import { UserRecordingBase } from "../recording/user-recording";
import { RecordingFile } from "../recording/recording-file";

export class DbRecordingFile extends RecordingFile {
    pdId: string;
    override recordings: UserRecordingBase[] = [];


    constructor(version: string, recordings: UserRecordingBase[], pbId: string) {
        super(version, []);
        this.pdId = pbId;

        recordings.forEach(recording => {
            recording.optimizePlaybackSize();
            this.recordings.push(UserRecordingBase.recreateFromDerivedClass(recording));
        });
    }
}