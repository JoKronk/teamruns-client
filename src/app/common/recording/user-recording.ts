import { RecordingBase } from "./recording-base";
import { Recording } from "./recording";
import { RecordingPositionData } from "./recording-position-data";
import { PositionData } from "../socket/position-data";
import { InteractionType } from "../opengoal/interaction-type";

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

    constructor(username: string, userId: string, gameVersion: string) {
        super(username, gameVersion);
        this.userId = userId;
    }

    //used to optimize format for file size
    addPositionData(newPos: PositionData) {
        let newRecordingPos: RecordingPositionData = new RecordingPositionData();
        const noInteraction: boolean = newPos.interType === undefined || newPos.interType === InteractionType.none;
        newRecordingPos.iT = noInteraction ? undefined : newPos.interType;
        newRecordingPos.iA = noInteraction ? undefined : newPos.interAmount;
        newRecordingPos.iS = noInteraction ? undefined : newPos.interStatus;
        newRecordingPos.iN = noInteraction ? undefined : newPos.interName;
        newRecordingPos.iP = noInteraction ? undefined : newPos.interParent;
        newRecordingPos.iL = noInteraction ? undefined : newPos.interLevel;
        newRecordingPos.iC = noInteraction ? undefined : newPos.interCleanup;
        newRecordingPos.tX = this.prevPosIn?.transX === newPos.transX ? undefined : newPos.transX;
        newRecordingPos.tY = this.prevPosIn?.transY === newPos.transY ? undefined : newPos.transY;
        newRecordingPos.tZ = this.prevPosIn?.transZ === newPos.transZ ? undefined : newPos.transZ;
        newRecordingPos.qX = this.prevPosIn?.quatX === newPos.quatX ? undefined : newPos.quatX;
        newRecordingPos.qY = this.prevPosIn?.quatY === newPos.quatY ? undefined : newPos.quatY;
        newRecordingPos.qZ = this.prevPosIn?.quatZ === newPos.quatZ ? undefined : newPos.quatZ;
        newRecordingPos.qW = this.prevPosIn?.quatW === newPos.quatW ? undefined : newPos.quatW;
        newRecordingPos.rY = this.prevPosIn?.rotY === newPos.rotY ? undefined : newPos.rotY;
        newRecordingPos.tS = this.prevPosIn?.tgtState === newPos.tgtState ? undefined : newPos.tgtState;
        newRecordingPos.cL = this.prevPosIn?.currentLevel === newPos.currentLevel ? undefined : newPos.currentLevel;
        newRecordingPos.t = newPos.time;
        
        this.playback.unshift(newRecordingPos);
        this.prevPosIn = newPos;
    }
}