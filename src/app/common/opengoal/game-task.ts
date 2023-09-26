import { UserBase } from "../user/user";
import { TaskStatus } from "./task-status";

export class GameTask {
    name: string;
    status: string;

    //filled in on teamrun side
    user: UserBase;
    timerTime: string;

    constructor(name: string, user: UserBase, timerTime: string, status: string = TaskStatus.needResolution) {
        this.name = name;
        this.user = user;
        this.timerTime = timerTime;
        this.status = status;
    }
}