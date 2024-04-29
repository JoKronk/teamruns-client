import { DbRecordingFile } from "../firestore/db-recording-file";
import { DbUsersCollection } from "../firestore/db-users-collection";
import { RecordingBase } from "./recording-base";
import { Recording } from "./recording";
import { RecordingFile } from "./recording-file";

export class SelectableRecording extends Recording {
    selected: boolean = true;

    constructor(displayName: string, gameVersion: string) {
        super(displayName, gameVersion);
    }

    static fromRecordingBase(baseRecording: Recording): SelectableRecording {
        let recording = new SelectableRecording(baseRecording.username, baseRecording.gameVersion);
        recording.playback = baseRecording.playback;
        recording.username = baseRecording.username;
        return recording;
    }

    static override fromRecordingFile(recFile: RecordingFile): SelectableRecording[] {
        let recordings: SelectableRecording[] = [];

        recFile.recordings.forEach(rec => {
            const recording = new SelectableRecording(rec.username, recFile.gameVersion);
            recording.playback = rec.playback;
            recording.fillFrontendValues();
            recordings.push(recording);
        });

        return recordings;
    }

    static override fromDbRecording(recFile: DbRecordingFile, userCollection: DbUsersCollection | undefined = undefined): SelectableRecording[] {
        let recordings: SelectableRecording[] = [];

        recFile.recordings.forEach(rec => {
            const recording = new SelectableRecording(userCollection?.users.find(x => x.id === rec.userId)?.name ?? rec.username, recFile.gameVersion);
            recording.playback = rec.playback;
            recording.fillFrontendValues();
            recordings.push(recording);
        });

        return recordings;
    }
}