import { InteractionType } from "../opengoal/interaction-type";
import { Timer } from "../run/timer";
import { PositionData } from "../socket/position-data";
import { RecordingFile } from "./recording-file";
import pkg from 'app/package.json';
import { RecordingPositionData } from "./recording-position-data";
import { DbUsersCollection } from "../firestore/db-users-collection";
import { DbRecordingFile } from "../firestore/db-recording-file";
import { RecordingBase } from "./recording-base";

export class Recording extends RecordingBase {
    id: string = crypto.randomUUID();

    prevPosIn: RecordingPositionData | undefined;
    posOut: PositionData = new PositionData();
    currentRecordingDataIndex: number;

    timeFrontend?: string;

    constructor(displayName: string) {
        super(displayName);
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

    //used to optimize format for file size
    addPositionData(newPos: PositionData) {
        let newRecordingPos: RecordingPositionData = new RecordingPositionData();
        const noInteraction: boolean = newPos.interType === InteractionType.none;
        newRecordingPos.iT = noInteraction ? undefined : newPos.interType;
        newRecordingPos.iA = noInteraction ? undefined : newPos.interAmount;
        newRecordingPos.iS = noInteraction ? undefined : newPos.interStatus;
        newRecordingPos.iN = noInteraction ? undefined : newPos.interName;
        newRecordingPos.iP = noInteraction ? undefined : newPos.interParent;
        newRecordingPos.iL = noInteraction ? undefined : newPos.interLevel;
        newRecordingPos.iC = noInteraction ? undefined : newPos.interCleanup;
        newRecordingPos.tX = this.prevPosIn?.tX === newPos.transX ? undefined : newPos.transX;
        newRecordingPos.tY = this.prevPosIn?.tY === newPos.transY ? undefined : newPos.transY;
        newRecordingPos.tZ = this.prevPosIn?.tZ === newPos.transZ ? undefined : newPos.transZ;
        newRecordingPos.qX = this.prevPosIn?.qX === newPos.quatX ? undefined : newPos.quatX;
        newRecordingPos.qY = this.prevPosIn?.qY === newPos.quatY ? undefined : newPos.quatY;
        newRecordingPos.qZ = this.prevPosIn?.qZ === newPos.quatZ ? undefined : newPos.quatZ;
        newRecordingPos.qW = this.prevPosIn?.qW === newPos.quatW ? undefined : newPos.quatW;
        newRecordingPos.rY = this.prevPosIn?.rY === newPos.rotY ? undefined : newPos.rotY;
        newRecordingPos.tS = this.prevPosIn?.tS === newPos.tgtState ? undefined : newPos.tgtState;
        newRecordingPos.cL = this.prevPosIn?.cL === newPos.currentLevel ? undefined : newPos.currentLevel;
        newRecordingPos.t = newPos.time;
        
        if (this.prevPosIn)
            this.playback.unshift(this.prevPosIn);

        this.prevPosIn = newRecordingPos;
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
        this.optimizePlaybackSize();
        const blob = new Blob([JSON.stringify(new RecordingFile(pkg.version, [this]))], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = this.username + '.json';
        link.href = url;
        link.click();
    }
}