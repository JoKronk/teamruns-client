import { UserPositionDataTimestamp } from "../playback/position-data";
import { Timer } from "../run/timer";
import { UserBase } from "../user/user";
import { TaskStatus } from "./task-status";

export class GameTask {
    name: string;
    status: string;

    //filled in on teamrun side
    user: UserBase;

    constructor(name: string, user: UserBase, status: string = TaskStatus.needResolution) {
        this.name = name;
        this.user = user;
        this.status = status;
    }

    public static fromPositionData(positionData: UserPositionDataTimestamp): GameTask {
        return {
            name: positionData.interName,
            status: TaskStatus.nameFromEnum(positionData.interAmount),
            user: new UserBase(positionData.userId, positionData.username)
        }
    }
}

export class GameTaskTime extends GameTask {
    timerTime: string;

    constructor(name: string, user: UserBase, timerTime: string, status: string = TaskStatus.needResolution) {
        super(name, user, status);
        this.timerTime = timerTime;
    }


    public static override fromPositionData(positionData: UserPositionDataTimestamp): GameTaskTime {
        return {
            name: positionData.interName,
            status: TaskStatus.nameFromEnum(positionData.interAmount),
            user: new UserBase(positionData.userId, positionData.username),
            timerTime: Timer.msToTimeFormat(positionData.time, true, true)
        }
    }
}

export class GameTaskLevelTime extends GameTaskTime {
    level: string;

    constructor(name: string, user: UserBase, level: string, timerTime: string, status: string = TaskStatus.needResolution) {
        super(name, user, timerTime, status);
        this.level = level;
    }


    public static override fromPositionData(positionData: UserPositionDataTimestamp): GameTaskLevelTime {
        return {
            name: positionData.interName,
            status: TaskStatus.nameFromEnum(positionData.interAmount),
            user: new UserBase(positionData.userId, positionData.username),
            timerTime: Timer.msToTimeFormat(positionData.time, true, true),
            level: positionData.interLevel
        }
    }
}