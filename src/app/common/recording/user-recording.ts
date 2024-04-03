import { RecordingBase } from "./recording-base";
import { Recording } from "./recording";
import { RecordingPositionData } from "./recording-position-data";

export class UserRecordingBase extends RecordingBase {
    userId: string | undefined;

    constructor(username: string, userId: string, playback: RecordingPositionData[] = []) {
        super(username, playback);
        this.userId = userId;
    }

    static override recreateFromDerivedClass(recording: UserRecordingBase) {
        return new UserRecordingBase(recording.username, recording.userId ?? crypto.randomUUID(), recording.playback);
    }
}

export class UserRecording extends Recording {
    userId: string;

    constructor(username: string, userId: string) {
        super(username);
        this.userId = userId;
    }
}