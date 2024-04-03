import { UserRecordingBase } from "../recording/user-recording";
import { RecordingFile } from "../recording/recording-file";

export class DbRecordingFile extends RecordingFile {
    pdId: string;
    override recordings: UserRecordingBase[] = [];


    constructor(version: string, recordings: UserRecordingBase[], pbId: string) {
        recordings.forEach(recording => {
            recording.optimizePlaybackSize();
        });
        super(version, recordings, false);
        this.pdId = pbId;
    }
}