import { CurrentPositionData } from "../socket/current-position-data";
import { InteractionData } from "../socket/interaction-data";
import { UserPositionData } from "../socket/position-data";
import { Timer } from "../run/timer";
import { UserBase } from "../user/user";
import { TaskStatus } from "./task-status";

export class GameTask {
    name: string;
    status: string;

    //filled in on teamruns side
    user: UserBase;

    constructor(name: string, user: UserBase, status: string = TaskStatus.needResolution) {
        this.name = name;
        this.user = user;
        this.status = status;
    }

    public static fromPositionData(positionData: UserPositionData): GameTask {
        return {
            name: positionData.interName,
            status: TaskStatus.nameFromEnum(positionData.interStatus),
            user: new UserBase(positionData.userId, positionData.username)
        }
    }
}

export class GameTaskLevelTime extends GameTask {
    timerTimeMs: number;
    level: string;

    constructor(name: string, user: UserBase, level: string, timerTimeMs: number, status: string = TaskStatus.needResolution) {
        super(name, user, status);
        this.timerTimeMs = timerTimeMs;
        this.level = level;
    }

    public static override fromPositionData(positionData: UserPositionData): GameTaskLevelTime {
        return {
            name: positionData.interName,
            status: TaskStatus.nameFromEnum(positionData.interStatus),
            user: new UserBase(positionData.userId, positionData.username),
            timerTimeMs: positionData.time,
            level: positionData.interLevel
        }
    }

    //interaction sent seperately just to ensure it's not null
    public static fromCurrentPositionData(positionData: CurrentPositionData, interaction: InteractionData, username: string): GameTaskLevelTime {
        return {
            name: interaction.interName,
            status: TaskStatus.nameFromEnum(interaction.interStatus),
            user: new UserBase(positionData.userId, username),
            timerTimeMs: interaction.time,
            level: interaction.interLevel
        }
    }
}