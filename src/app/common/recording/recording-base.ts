import { RecordingPositionData } from "./recording-position-data";

export class RecordingBase {
    username: string;
    playback: RecordingPositionData[];
    
    constructor(displayName: string, playback: RecordingPositionData[] = []) {
        this.username = displayName;
        this.playback = playback;
    }

    static recreateFromDerivedClass(recording: RecordingBase) {
        return new RecordingBase(recording.username, recording.playback);
    }

    optimizePlaybackSize() {
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
}