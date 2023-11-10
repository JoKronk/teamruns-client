import { GameTask, GameTaskLevelTime } from "../opengoal/game-task";
import { Level } from "../opengoal/levels";
import { Task } from "../opengoal/task";
import { TaskStatus } from "../opengoal/task-status";
import { Buzzer, BuzzerBase } from "./buzzer";
import { Crate, CrateBase } from "./crate";
import { DarkCrystal } from "./dark-crystal";
import { EnemyBase } from "./enemy";
import { LevelCollectables } from "./level-collectables";
import { Orb, OrbBase } from "./orb";

export class RunStateHandler {
    levels: LevelCollectables[] = [];

    ////unused in LevelHandler
    tasksStatuses: GameTaskLevelTime[];
    cellCount: number;
    buzzerCount: number;
    orbCount: number;

    constructor() {
        this.levels = [];
        this.tasksStatuses = [];
        this.cellCount = 0;
        this.buzzerCount = 0;
        this.orbCount = 0;
    }

    isNewTaskStatus(task: GameTask): boolean {
        const statusValue: number = TaskStatus.getEnumValue(task.status);
        return !this.tasksStatuses.some(x => x.name === task.name) || TaskStatus.getEnumValue(this.tasksStatuses.find(x => x.name === task.name)!.status) < statusValue;
    }

    hasAtleastTaskStatus(task: GameTask, status: string): boolean {
        return this.tasksStatuses.some(x => x.name === task.name) && TaskStatus.getEnumValue(this.tasksStatuses.find(x => x.name === task.name)!.status) >= TaskStatus.getEnumValue(status)
    }

    addTask(task: GameTaskLevelTime) {
        //update general task status
        let oldTaskStatus = this.tasksStatuses.find(x => x.name === task.name);
        if (oldTaskStatus)
            this.tasksStatuses[this.tasksStatuses.indexOf(oldTaskStatus)] = task;
        else
            this.tasksStatuses.push(task);

        //add task status for level
        const level = this.getCreateLevel(task.level);
        level.taskUpdates.push(task);

        //update counts
        if (Task.isCellCollect(task)) {
            this.cellCount += 1;
            this.orbCount -= Task.cellCost(task);
        }
    }

    addBuzzer(buzzer: Buzzer) {
        const level = this.getCreateLevel(buzzer.level);
        level.buzzerUpdates.push(new BuzzerBase(buzzer.id, buzzer.parentEname));
        this.buzzerCount += 1;
    }

    addOrb(orb: Orb, level: LevelCollectables | undefined = undefined) {
        if (!level)
            level = this.getCreateLevel(orb.level);
    
        level.orbUpdates.push(new OrbBase(orb.ename, orb.parentEname));
        this.orbCount += 1;
    }

    addCrate(crate: Crate) {
        const level = this.getCreateLevel(crate.level);
        level.crateUpdates.push(new CrateBase(crate.ename, crate.type, crate.pickupAmount));
    }

    addEnemy(enemy: EnemyBase, levelName: string) {
        const level = this.getCreateLevel(levelName);
        level.enemyUpdates.push(enemy);
    }

    addPeriscope(periscope: string) {
        const level = this.getCreateLevel(Level.jungle);
        level.periscopeUpdates.push(periscope);
    }

    addSnowBumper(bumper: string) {
        const level = this.getCreateLevel(Level.snowy);
        level.snowBumberUpdates.push(bumper);
    }

    addDarkCrystal(crystal: DarkCrystal) {
        const level = this.getCreateLevel(crystal.level);
        level.darkCrystalUpdates.push(crystal.ename);
    }


    getCreateLevel(levelName: string): LevelCollectables {
        let level = this.levels.find(x => x.levelName === levelName);
        if (!level) {
            level = new LevelCollectables(levelName);
            this.levels.push(level);
        }
        return level;
    }


    isOrbDupe(orb: Orb, level: LevelCollectables | undefined = undefined): boolean {
        if (!level)
            level = this.getCreateLevel(orb.level);

        if (orb.parentEname.startsWith("orb-cache-top-"))
            return 15 < (level.orbUpdates.filter(x => x.parentEname === orb.parentEname).length + 1);
        else if (orb.parentEname.startsWith("crate-")) {
            let parentCrate = level.crateUpdates.find(x => x.ename === orb.parentEname);
            if (parentCrate) 
                return parentCrate.pickupAmount < (level.orbUpdates.filter(x => x.parentEname === orb.parentEname).length + 1);
            return false;
        }
        else if (orb.parentEname.startsWith("gnawer-")) {
            let parentGnawer = level.enemyUpdates.find(x => x.ename === orb.parentEname);
            if (parentGnawer) 
                return parentGnawer.pickupAmount < (level.orbUpdates.filter(x => x.parentEname === orb.parentEname).length + 1);
            return false;
        }
        else if (orb.parentEname.startsWith("plant-boss-")) {
            return 5 < (level.orbUpdates.filter(x => x.parentEname === orb.parentEname).length + 1);
        }
        else {
            return level.orbUpdates.find(x => x.ename === orb.ename) !== undefined; 
        }
    }
}