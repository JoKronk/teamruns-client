import { InteractionType } from "../opengoal/interaction-type";
import { Timer } from "../run/timer";
import { PositionData, RecordingPositionData } from "./position-data";
import { RecordingFile } from "./recording-file";

export class Recording {
    id: string = crypto.randomUUID();
    userId: string;
    playback: RecordingPositionData[] = [];

    prevPosIn: RecordingPositionData | undefined;
    posOut: PositionData = new PositionData();
    currentRecordingDataIndex: number;

    timeFrontend?: string;
    nameFrontend?: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    exportRecordingToBlob(version: string) : Blob {
        this.formatPlayback();
        const recFile: RecordingFile = new RecordingFile(version, this.playback, this.nameFrontend);
        const fileData = JSON.stringify(recFile);
        return new Blob([fileData], {type: "text/plain"});
    }

    formatPlayback() {
        let prevData: RecordingPositionData = new RecordingPositionData();
        for (let i = this.playback.length - 1; i >= 0; i--)
        {
            if (this.playback[i].tX) this.playback[i].tX = Math.round((this.playback[i].tX! + Number.EPSILON) * 10) / 10;
            if (this.playback[i].tY) this.playback[i].tY = Math.round((this.playback[i].tY! + Number.EPSILON) * 10) / 10;
            if (this.playback[i].tZ) this.playback[i].tZ = Math.round((this.playback[i].tZ! + Number.EPSILON) * 10) / 10;
            if (this.playback[i].qX) this.playback[i].qX = Math.round((this.playback[i].qX! + Number.EPSILON) * 1000) / 1000;
            if (this.playback[i].qY) this.playback[i].qY = Math.round((this.playback[i].qY! + Number.EPSILON) * 1000) / 1000;
            if (this.playback[i].qZ) this.playback[i].qZ = Math.round((this.playback[i].qZ! + Number.EPSILON) * 1000) / 1000;
            if (this.playback[i].qW) this.playback[i].qW = Math.round((this.playback[i].qW! + Number.EPSILON) * 1000) / 1000;
            if (this.playback[i].rY) this.playback[i].rY = Math.round((this.playback[i].rY! + Number.EPSILON) * 1000) / 1000;

            if (prevData.tX === this.playback[i].tX) this.playback[i].tX = undefined;
            if (prevData.tY === this.playback[i].tY) this.playback[i].tY = undefined;
            if (prevData.tZ === this.playback[i].tZ) this.playback[i].tZ = undefined;
            if (prevData.qX === this.playback[i].qX) this.playback[i].qX = undefined;
            if (prevData.qY === this.playback[i].qY) this.playback[i].qY = undefined;
            if (prevData.qZ === this.playback[i].qZ) this.playback[i].qZ = undefined;
            if (prevData.qW === this.playback[i].qW) this.playback[i].qW = undefined;
            if (prevData.rY === this.playback[i].rY) this.playback[i].rY = undefined;
            
            if (this.playback[i].tX) prevData.tX = this.playback[i].tX;
            if (this.playback[i].tY) prevData.tY = this.playback[i].tY;
            if (this.playback[i].tZ) prevData.tZ = this.playback[i].tZ;
            if (this.playback[i].qX) prevData.qX = this.playback[i].qX;
            if (this.playback[i].qY) prevData.qY = this.playback[i].qY;
            if (this.playback[i].qZ) prevData.qZ = this.playback[i].qZ;
            if (this.playback[i].qW) prevData.qW = this.playback[i].qW;
            if (this.playback[i].qW) prevData.rY = this.playback[i].rY;
        }
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

    fillFrontendValues(name: string) {
        this.nameFrontend = name;
        this.timeFrontend = this.playback.length === 0 ? "0s" : Timer.msToTimeFormat(this.playback[0].t, true, true);
    }

    clean() {
        this.timeFrontend = undefined;
        this.nameFrontend = undefined;
    }
}

export class SelectableRecording extends Recording {
    selected: boolean = true;

    constructor(userId: string) {
        super(userId);
    }
}