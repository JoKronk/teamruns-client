import { GameTask } from "../opengoal/game-task";
import { Task } from "../opengoal/task";
import { TaskStatus } from "../opengoal/task-status";
import { Buzzer, BuzzerBase } from "./buzzer";
import { Crate, CrateBase } from "./crate";
import { LevelCollectables } from "./level-collectables";
import { Orb, OrbBase } from "./orb";

export class RunStateMapper {
    levels: LevelCollectables[] = [];
    tasksStatuses: Map<string, number>; //unused in LevelHandler

    constructor() {
        this.levels = [];
        this.tasksStatuses = new Map();
    }

    isNewTaskStatus(task: GameTask) {
        const statusValue: number = TaskStatus.getEnumValue(task.status);
        return !this.tasksStatuses.has(task.name) || this.tasksStatuses.get(task.name)! < statusValue;
    }

    addTask(task: GameTask) {
        this.tasksStatuses.set(task.name, TaskStatus.getEnumValue(task.status));

        //add cell if open cell
        const ename = Task.getCellEname(task.name);
        if (ename) {
            const levelName = Task.getCellLevelByEname(ename);
            if (levelName)
                this.addCell(levelName, ename);
        }
    }

    addCell(levelName: string, ename: string) {
        const level = this.getCreateLevel(levelName);
        level.cellUpdates.push(ename);
    }

    addBuzzer(buzzer: Buzzer) {
        const level = this.getCreateLevel(buzzer.level);
        level.buzzerUpdates.push(new BuzzerBase(buzzer));
    }

    addOrb(orb: Orb) {
        const level = this.getCreateLevel(orb.level);
        level.orbUpdates.push(new OrbBase(orb));
    }

    addCrate(crate: Crate) {
        const level = this.getCreateLevel(crate.level);
        level.crateUpdates.push(new CrateBase(crate));
    }

    private getCreateLevel(levelName: string): LevelCollectables {
        let level = this.levels.find(x => x.levelName === levelName);
        if (!level) {
            level = new LevelCollectables(levelName);
            this.levels.push(level);
        }
        return level;
    }
}