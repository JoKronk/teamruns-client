import { InteractionType } from "../opengoal/interaction-type";
import { Timer } from "../run/timer";
import { PositionData } from "../socket/position-data";
import { RecordingFile } from "./recording-file";
import pkg from 'app/package.json';
import { DbUsersCollection } from "../firestore/db-users-collection";
import { DbRecordingFile } from "../firestore/db-recording-file";
import { RecordingBase } from "./recording-base";
import { CategoryOption } from "../run/category";
import { UserBase } from "../user/user";
import { MultiplayerState } from "../opengoal/multiplayer-state";

export class Recording extends RecordingBase {
    id: string = crypto.randomUUID();

    state: MultiplayerState = MultiplayerState.active;
    prevPosIn: PositionData | undefined;
    posOut: PositionData = new PositionData();
    currentRecordingDataIndex: number;

    timeFrontend?: string;

    constructor(displayName: string) {
        super(displayName);
    }

    static getUserBase(recording: Recording) { //static because in most use cases the recording won't have class functions
        return new UserBase(recording.id, recording.username);
    }

    static fromRecordingFile(recFile: RecordingFile): Recording[] {
        let recordings: Recording[] = [];

        recFile.recordings.forEach(rec => {
            const recording = new Recording(rec.username);
            recording.playback = rec.playback;
            recording.fillFrontendValues();
            recordings.push(recording);
        });

        return recordings;
    }

    static fromDbRecording(recFile: DbRecordingFile, userCollection: DbUsersCollection | undefined = undefined): Recording[] {
        let recordings: Recording[] = [];

        recFile.recordings.forEach(rec => {
            const recording = new Recording(userCollection?.users.find(x => x.id === rec.userId)?.name ?? rec.username);
            recording.playback = rec.playback;
            recording.fillFrontendValues();
            recordings.push(recording);
        });

        return recordings;
    }

    getNextPositionData(time: number): PositionData {
        const recPos = this.playback.find(x => x.t < time);
        if (!recPos) {
            if (this.posOut.interType)
                this.posOut.interType = InteractionType.none;
            return this.posOut;
        }

        const newRecordingDataIndex = this.playback.indexOf(recPos);
        if (this.currentRecordingDataIndex === newRecordingDataIndex) return this.posOut;
        
        this.posOut.interType = recPos.iT ?? InteractionType.none;
        this.posOut.interAmount = recPos.iA ?? 0;
        this.posOut.interStatus = recPos.iS ?? 0;
        this.posOut.interName = recPos.iN ?? "";
        this.posOut.interParent = recPos.iP ?? "";
        this.posOut.interLevel = recPos.iL ?? "";
        this.posOut.interCleanup = recPos.iC ?? false;
        if (recPos.tX) this.posOut.transX = recPos.tX;
        if (recPos.tY) this.posOut.transY = recPos.tY;
        if (recPos.tZ) this.posOut.transZ = recPos.tZ;
        if (recPos.qX) this.posOut.quatX = recPos.qX;
        if (recPos.qY) this.posOut.quatY = recPos.qY;
        if (recPos.qZ) this.posOut.quatZ = recPos.qZ;
        if (recPos.qW) this.posOut.quatW = recPos.qW;
        if (recPos.rY) this.posOut.rotY = recPos.rY;
        if (recPos.tS) this.posOut.tgtState = recPos.tS;
        if (recPos.cL) this.posOut.currentLevel = recPos.cL;
        if (recPos.t) this.posOut.time = recPos.t;
        
        this.currentRecordingDataIndex = newRecordingDataIndex;

        return this.posOut;
    }

    fillFrontendValues() {
        this.timeFrontend = this.playback.length === 0 ? "0s" : Timer.msToTimeFormat(this.playback[0].t, true, true);
    }

    clean() {
        this.timeFrontend = undefined;
    }

    exportRecording() {
        const blob = new Blob([JSON.stringify(new RecordingFile(pkg.version, [this]))], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = this.username + '.json';
        link.href = url;
        link.click();
    }

    static exportDbRecording(recording: DbRecordingFile, userCollection: DbUsersCollection | undefined = undefined) {
        if (userCollection) {
            recording.recordings.forEach(rec => {
                rec.username = userCollection?.users.find(x => x.id === rec.userId)?.name ?? rec.username;
            });
        }
        
        const blob = new Blob([JSON.stringify(new RecordingFile(recording.version, recording.recordings, recording.runData))], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = CategoryOption[recording.runData?.category ?? 0] + 'Pb.json';
        link.href = url;
        link.click();
    }
}