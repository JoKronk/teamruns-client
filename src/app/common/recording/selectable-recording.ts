import { DbRecordingFile } from "../firestore/db-recording-file";
import { DbUsersCollection } from "../firestore/db-users-collection";
import { RecordingBase } from "./recording-base";
import { Recording } from "./recording";
import { RecordingFile } from "./recording-file";

export class SelectableRecording extends Recording {
    selected: boolean = true;

    constructor(displayName: string) {
        super(displayName);
    }

    static fromRecordingBase(baseRecording: RecordingBase): SelectableRecording {
        let recording = new SelectableRecording(baseRecording.username);
        recording.playback = baseRecording.playback;
        recording.username = baseRecording.username;
        return recording;
    }

    static override fromRecordingFile(recFile: RecordingFile, userCollection: DbUsersCollection | undefined = undefined): SelectableRecording[] {
        let recordings: SelectableRecording[] = [];

        recFile.recordings.forEach(rec => {
            const recording = new SelectableRecording(rec.username);
            recording.playback = rec.playback;
            recording.fillFrontendValues();
            recordings.push(recording);
        });

        return recordings;
    }

    static override fromDbRecording(recFile: DbRecordingFile, userCollection: DbUsersCollection | undefined = undefined): Recording[] {
        let recordings: SelectableRecording[] = [];

        recFile.recordings.forEach(rec => {
            const recording = new SelectableRecording(userCollection?.users.find(x => x.id === rec.userId)?.name ?? rec.username);
            recording.playback = rec.playback;
            recording.fillFrontendValues();
            recordings.push(recording);
        });

        return recordings;
    }
}