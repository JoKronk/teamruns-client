import { Buzzer, BuzzerBase } from "./buzzer";
import { GameTask, GameTaskLevelTime } from "../opengoal/game-task";
import { OG } from "../opengoal/og";
import { Orb, OrbBase } from "./orb";
import { Task } from "../opengoal/task";
import { LevelStatus } from "./level-status";
import { Crate, CrateBase } from "./crate";
import { Eco } from "./eco";
import { RunStateHandler } from "./run-state-handler";
import { LocalPlayerData } from "../user/local-player-data";
import { Level } from "../opengoal/levels";
import { DarkCrystal } from "./dark-crystal";
import { EnemyBase } from "./enemy";

export class LevelHandler {

    uncollectedLevelItems: RunStateHandler = new RunStateHandler();
    levels: LevelStatus[] = [];

    constructor() {

    }

    importRunStateHandler(runStateHandler: RunStateHandler, localPlayer: LocalPlayerData, teamPlayerCheckpoint: string) {

        //reset game
        OG.runCommand("(initialize! *game-info* 'game (the-as game-save #f) (the-as string #f))");

        //import task statuses to game
        runStateHandler.tasksStatuses.forEach(task => {
            const isCell = Task.isCellCollect(task);

            this.onNewTask(task, isCell);

            if (isCell) {
                const cost = Task.cellCost(task);
                if (cost !== 0)
                    OG.runCommand("(send-event *target* 'get-pickup 5 -" + cost + ".0)");
            }
        });
          
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

            level.enemyUpdates.forEach(enemy => {
                this.onEnemyDeath(enemy, level.levelName);
            });

            level.periscopeUpdates.forEach(scope => {
                this.activatePeriscope(scope);
            });

            level.snowBumberUpdates.forEach(bumper => {
                this.deactivateSnowBumper(bumper);
            });

            level.darkCrystalUpdates.forEach(bumper => {
                this.explodeDarkCrystal(bumper);
            });
               
            if (level.lpcChamberPosition)
                this.moveLpcChamber(level.lpcChamberPosition)



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



    onNewTask(task: GameTaskLevelTime, isCell: boolean) {
        OG.updateTask(task, isCell);

        if (!this.levelIsActive(task.level))
            this.uncollectedLevelItems.addTask(task);
    }

    onBuzzerCollect(buzzer: Buzzer) {
        OG.runCommand('(give-buzzer-from-level ' + buzzer.id + '.0 "' + buzzer.level + '")');

        if (this.levelIsActive(buzzer.level))
            this.killBuzzer(buzzer, true, false);
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

    onEnemyDeath(enemy: EnemyBase, levelName: string) {
        if (this.levelIsActive(levelName))
            this.killEnemy(enemy.ename);
        else
            this.uncollectedLevelItems.addEnemy(enemy, levelName);
    }

    onPeriscopeActivated(periscope: string) {
        if (this.levelIsActive(Level.jungle))
            this.activatePeriscope(periscope);
        else
            this.uncollectedLevelItems.addPeriscope(periscope);
    }

    onSnowBumperDeactivate(snowBumper: string) {
        if (this.levelIsActive(Level.snowy))
            this.deactivateSnowBumper(snowBumper);
        else
            this.uncollectedLevelItems.addSnowBumper(snowBumper);
    }

    onDarkCrystalExplode(crystal: DarkCrystal) {
        if (this.levelIsActive(crystal.level))
            this.explodeDarkCrystal(crystal.ename);
        else
            this.uncollectedLevelItems.addDarkCrystal(crystal);
    }

    onLpcChamberStop(chamberLevel: number) {
        if (this.levelIsActive(Level.hub2) || this.levelIsActive(Level.lpcBottomPart))
            this.moveLpcChamber(chamberLevel);
        else
            this.uncollectedLevelItems.setLpcChamber(chamberLevel);
    }

    onEcoPickup(eco: Eco) {
        if (!this.levelIsActive(eco.level)) return;

        if (eco.parentEname.startsWith("crate-"))
            OG.runCommand('(safe-pickup-crate-eco "' + eco.parentEname + '")');
        else if (!eco.ename.startsWith("ecovent-"))
            OG.runCommand('(safe-pickup-eco "' + eco.ename + '")');
    }



    // ----- internal methods -----

    public levelIsActive(levelName: string): boolean {
        let level = this.levels.find(x => x.name === levelName);
        if (!level)
            return false;
        return level.status === LevelStatus.Active || level.status === LevelStatus.Alive;
    }

    private onLevelActive(levelName: string) {
        setTimeout(() => {
            let level = this.uncollectedLevelItems.levels.find(x => x.levelName === levelName);
            if (!level || (
                level.taskUpdates.length === 0 &&
                level.orbUpdates.length === 0 && 
                level.buzzerUpdates.length === 0 && 
                level.crateUpdates.length === 0 &&
                level.enemyUpdates.length === 0 &&
                level.periscopeUpdates.length === 0 &&
                level.snowBumberUpdates.length === 0 &&
                level.darkCrystalUpdates.length === 0
                )) return;



            console.log("killing from level", level)

            level.crateUpdates.forEach(crate => {
                this.destroyCrate(crate);
            });

            level.enemyUpdates.forEach(enemy => {
                this.killEnemy(enemy.ename);
            });
            
            level.buzzerUpdates.forEach((buzzer, index) => {
                this.killBuzzer(buzzer, index + 1 === level!.buzzerUpdates.length, true); //spawn cell only at last if complete
                this.uncollectedLevelItems.buzzerCount -= 1;
            });

            level.orbUpdates.forEach(orb => {
                this.killOrb(orb);
                this.uncollectedLevelItems.orbCount -= 1;
            });

            level.periscopeUpdates.forEach(scope => {
                this.activatePeriscope(scope);
            });

            level.snowBumberUpdates.forEach(bumper => {
                this.deactivateSnowBumper(bumper);
            });

            level.darkCrystalUpdates.forEach(crystal => {
                this.explodeDarkCrystal(crystal);
            });
            
            if (level.lpcChamberPosition != 0)
                this.moveLpcChamber(level.lpcChamberPosition)

            level.taskUpdates.forEach(task => {
                this.runRemoteTaskUpdate(task);
                if (Task.isCellCollect(task))
                    this.uncollectedLevelItems.cellCount -= 1; 
            });
    
            level.taskUpdates = [];
            level.buzzerUpdates = [];
            level.orbUpdates = [];
            level.crateUpdates = [];
            level.enemyUpdates = [];
            level.periscopeUpdates = [];
            level.snowBumberUpdates = [];
            level.darkCrystalUpdates = [];
            level.lpcChamberPosition = 0;
        }, 1500);
    }




    // ----- collection logic ----- | these are stored here instead of being methods of their own type so we don't have to Object.assign() every collectable
    
    private runRemoteTaskUpdate(task: GameTask) {
        OG.runCommand('(handle-remote-task-update (game-task ' + task.name + ') (task-status ' + task.status + '))');
    }
    
    private killBuzzer(buzzer: BuzzerBase, runPickup: boolean, killIfNotBuzzer: boolean) {
        if (buzzer.parentEname.startsWith("crate-"))
            OG.runCommand('(safe-kill-crate-buzzer "' + buzzer.parentEname + '" ' + (runPickup ? "#t" : "#f") + ' ' + (killIfNotBuzzer ? "#t" : "#f") + ')');
    }

    private killOrb(orb: OrbBase) {
        if (orb.parentEname.startsWith("orb-cache-top-"))
            OG.runCommand('(safe-kill-cache-orb "' + orb.parentEname + '")');
        else if (orb.parentEname.startsWith("crate-"))
            OG.runCommand('(safe-kill-crate-orb "' + orb.parentEname + '")');
        else if (orb.parentEname.startsWith("gnawer-"))
            OG.runCommand('(safe-kill-gnawer-orb "' + orb.parentEname + '")');
        else if (orb.parentEname.startsWith("plant-boss-"))
            OG.runCommand('(safe-kill-plant-boss-orb "' + orb.parentEname + '")');
        else
            OG.runCommand('(safe-kill-orb "' + orb.ename + '")');
    }

    private destroyCrate(crate: CrateBase) {
        OG.runCommand('(safe-break-crate "' + crate.ename + '")');
    }

    private killEnemy(ename: string) {
        OG.runCommand('(safe-kill-enemy "' + ename + '")');
    }

    private activatePeriscope(periscope: string) {
        OG.runCommand('(periscope-activate-by-name "' + periscope + '")');
    }

    private deactivateSnowBumper(bumper: string) {
        OG.runCommand('(safe-deactivate-snow-bumper "' + bumper + '")');
    }

    private explodeDarkCrystal(crystal: string) {
        OG.runCommand('(safe-explode-dark-crystal "' + crystal + '")');
    }

    private moveLpcChamber(chamberLevel: number) {
        OG.runCommand('(safe-move-lpc-chamber ' + chamberLevel + ')');
    }
}