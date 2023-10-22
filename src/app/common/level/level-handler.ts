import { Buzzer, BuzzerBase } from "./buzzer";
import { GameTask } from "../opengoal/game-task";
import { OG } from "../opengoal/og";
import { Orb, OrbBase } from "./orb";
import { Task } from "../opengoal/task";
import { LevelStatus } from "./level-status";
import { Crate, CrateBase } from "./crate";
import { Eco } from "./eco";
import { RunStateHandler } from "./run-state-handler";
import { TaskStatus } from "../opengoal/task-status";
import { LocalPlayerData } from "../user/local-player-data";

export class LevelHandler {

    uncollectedLevelItems: RunStateHandler = new RunStateHandler();
    levels: LevelStatus[] = [];

    constructor() {

    }

    importRunStateHandler(runStateHandler: RunStateHandler, localPlayer: LocalPlayerData, teamPlayerCheckpoint: string) {

        //reset game
        OG.runCommand("(initialize! *game-info* 'game (the-as game-save #f) (the-as string #f))");

        //import task statuses to game
        const taskStatuses = TaskStatus.getTaskNames();
        for (const [name, status] of Object.entries(runStateHandler.tasksStatuses)) {
            const task: GameTask = new GameTask(name, localPlayer.user, "0.0", taskStatuses[status]);
            const isCell = Task.isCellCollect(task);

            this.onNewTask(task, isCell);

            if (isCell) {
                const cost = Task.cellCost(task);
                if (cost !== 0)
                    OG.runCommand("(send-event *target* 'get-pickup 5 -" + cost + ".0)");
            }
          }
          
        OG.runCommand("(reset-actors 'life)");


        //update collectables
        runStateHandler.levels.forEach(level => {

        level.buzzerUpdates.forEach(buzzerBase => {
            this.onBuzzerCollect(new Buzzer(buzzerBase, level.levelName));
        });

        level.orbUpdates.forEach(orbBase => {
            this.onOrbCollect(new Orb(orbBase, level.levelName));
        });

        level.crateUpdates.forEach(crateBase => {
            this.onCrateDestroy(new Crate(crateBase, level.levelName));
        });
        });

        //tp to first team player checkpoint
        OG.runCommand("(start 'play (get-continue-by-name *game-info* " + teamPlayerCheckpoint + "))");
    }
    

    // ----- update handlers -----

    onLevelsUpdate(levels: LevelStatus[]) {
        this.levels = levels;
        this.levels.forEach(level => {
            if (level.status === LevelStatus.Active || level.status === LevelStatus.Alive)
                this.onLevelActive(level.name);
        });
    }



    onNewTask(task: GameTask, isCell: boolean) {
        OG.updateTask(task, isCell);

        const ename = Task.getCellEname(task.name);
        if (!ename) return;
        const levelName = Task.getCellLevelByEname(ename);
        if (!levelName) return;

        if (this.levelIsActive(levelName))
            this.killCell(ename);
        else
            this.uncollectedLevelItems.addCell(task.name, levelName);
    }

    onBuzzerCollect(buzzer: Buzzer) {
        OG.runCommand('(give-buzzer-from-level ' + buzzer.id + '.0 "' + buzzer.level + '")');

        if (this.levelIsActive(buzzer.level))
            this.killBuzzer(buzzer);
        else
            this.uncollectedLevelItems.addBuzzer(buzzer);
    }

    onOrbCollect(orb: Orb) {
        OG.runCommand('(give-money-from-level "' + orb.level + '")');
        
        if (this.levelIsActive(orb.level))
            this.killOrb(orb);
        else
            this.uncollectedLevelItems.addOrb(orb);
    }

    onCrateDestroy(crate: Crate) {
        if (this.levelIsActive(crate.level))
            this.destroyCrate(crate);
        else if (Crate.isBuzzerType(crate.type) || Crate.isOrbsType(crate.type))
            this.uncollectedLevelItems.addCrate(crate);
    }

    onEcoPickup(eco: Eco) {
        if (!this.levelIsActive(eco.level)) return;

        if (eco.parentEname.startsWith("crate-"))
            OG.runCommand('(safe-pickup-crate-eco "' + eco.parentEname + '")');
        else if (!eco.ename.startsWith("ecovent-"))
            OG.runCommand('(safe-pickup-eco "' + eco.ename + '")');
    }



    // ----- internal methods -----

    private levelIsActive(levelName: string): boolean {
        let level = this.levels.find(x => x.name === levelName);
        if (!level)
            return false;
        return level.status === LevelStatus.Active || level.status === LevelStatus.Alive;
    }

    private onLevelActive(levelName: string) {
        setTimeout(() => {
            let level = this.uncollectedLevelItems.levels.find(x => x.levelName === levelName);
            if (!level || (level.orbUpdates.length === 0 && level.buzzerUpdates.length === 0 && level.cellUpdates.length === 0)) return;
            console.log("killing from level", level)

            level.crateUpdates.forEach(crate => {
                this.destroyCrate(crate);
            });
            level.cellUpdates.forEach(taskName => {
                const ename = Task.getCellEname(taskName);
                if (ename) {
                    this.killCell(ename);
                    this.uncollectedLevelItems.cellCount -= 1;
                }
            });
            level.buzzerUpdates.forEach(buzzer => {
                this.killBuzzer(buzzer);
                this.uncollectedLevelItems.buzzerCount -= 1;
            });
            level.orbUpdates.forEach(orb => {
                this.killOrb(orb);
                this.uncollectedLevelItems.orbCount -= 1;
            });
    
            level.cellUpdates = [];
            level.buzzerUpdates = [];
            level.orbUpdates = [];
            level.crateUpdates = [];
        }, 500);
    }




    // ----- collection logic ----- | these are stored here instead of being methods of their own type so we don't have to Object.assign() every collectable
    
    private killCell(ename: string) {
        OG.runCommand('(safe-kill-fuel-cell "' + ename + '")');
    }
    
    private killBuzzer(buzzer: BuzzerBase) {
        if (buzzer.parentEname.startsWith("crate-"))
            OG.runCommand('(safe-kill-crate-buzzer "' + buzzer.parentEname + '")');
    }

    private killOrb(orb: OrbBase) {
        if (orb.parentEname.startsWith("orb-cache-top-"))
            OG.runCommand('(safe-kill-cache-orb "' + orb.parentEname + '")');
        else if (orb.parentEname.startsWith("crate-"))
            OG.runCommand('(safe-kill-crate-orb "' + orb.parentEname + '")');
        else
            OG.runCommand('(safe-kill-orb "' + orb.ename + '")');
    }

    private destroyCrate(crate: CrateBase) {
        OG.runCommand('(safe-break-crate "' + crate.ename + '")');
    }
}