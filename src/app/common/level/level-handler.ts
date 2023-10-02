import { Buzzer, BuzzerBase } from "./buzzer";
import { GameTask } from "../opengoal/game-task";
import { OG } from "../opengoal/og";
import { Orb, OrbBase } from "./orb";
import { Task } from "../opengoal/task";
import { LevelStatus } from "./level-status";
import { LevelUpdateStorage } from "./level-update-storage";
import { Crate, CrateBase } from "./crate";
import { Eco } from "./eco";

export class LevelHandler {

    levelStorages: LevelUpdateStorage[] = [];
    levels: LevelStatus[] = [];

    constructor() {

    }

    // ----- update handlers -----

    onLevelsUpdate(levels: LevelStatus[]) {
        this.levels = levels;
        this.levels.forEach(level => {
            if (level.status === LevelStatus.Active)
                this.onLevelActive(level.name);
        });
    }



    onNewCell(cell: GameTask) {
        const ename = Task.getCellEname(cell.name);
        if (!ename) return;
        const levelName = Task.getCellLevelByEname(ename);
        if (!levelName) return;

        if (!this.levelIsActive(levelName)) {
            const level = this.getCreateLevel(levelName);
            level.cellUpdates.push(ename);
            return;
        }
    }

    onBuzzerCollect(buzzer: Buzzer) {
        OG.runCommand('(pickup-collectable! (-> *target* fact-info-target) (pickup-type buzzer) ' + buzzer.id + '.0 (process->handle (-> (-> *target* fact-info-target) process)))');
        
        if (this.levelIsActive(buzzer.level))
            this.setCollectedBuzzer(buzzer);
        else {
            const level = this.getCreateLevel(buzzer.level);
            level.buzzerUpdates.push(new BuzzerBase(buzzer));
        }
    }

    onOrbCollect(orb: Orb) {
        OG.runCommand("(send-event *target* 'get-pickup 5 1.0)");
        
        if (this.levelIsActive(orb.level))
            this.setCollectedOrb(orb, true);
        else {
            const level = this.getCreateLevel(orb.level);
            level.orbUpdates.push(new OrbBase(orb));
        }
    }

    onCrateDestroy(crate: Crate) {
        if (!this.levelIsActive(crate.level))
            this.destroyCrate(crate);
        else if (crate.type === Crate.typeWithBuzzer || crate.type === Crate.typeWithOrbs) {
            const level = this.getCreateLevel(crate.level);
            level.crateUpdates.push(new CrateBase(crate));
        }
    }

    onEcoPickup(eco: Eco) {
        if (!this.levelIsActive(eco.level)) return;

        if (eco.parentEname.startsWith("crate-"))
            OG.runCommand('safe-pickup-crate-eco "' + eco.parentEname + '"');
        else
            OG.runCommand('safe-pickup-eco "' + eco.ename + '"');
    }



    // ----- internal methods -----

    private levelIsActive(levelName: string): boolean {
        let level = this.levels.find(x => x.name === levelName);
        if (!level)
            return false;
        return level.status === LevelStatus.Active;
    }

    private getCreateLevel(levelName: string): LevelUpdateStorage {
        let level = this.levelStorages.find(x => x.levelName === levelName);
        if (!level) {
            level = new LevelUpdateStorage(levelName);
            this.levelStorages.push(level);
        }
        return level;
    }

    private onLevelActive(levelName: string) {
        let level = this.levelStorages.find(x => x.levelName === levelName);
        if (!level || (level.orbUpdates.length === 0 && level.buzzerUpdates.length === 0 && level.cellUpdates.length === 0)) return;
        
        level.crateUpdates.forEach(crate => {
            this.destroyCrate(crate);
        });
        level.cellUpdates.forEach(ename => {
            OG.runCommand('(process-entity-status! (the-as fuel-cell (process-by-ename "' + ename + '")) (entity-perm-status dead) #t)');
        });
        level.buzzerUpdates.forEach(buzzer => {
            this.setCollectedBuzzer(buzzer);
        });
        level.orbUpdates.forEach(orb => {
            this.setCollectedOrb(orb, false);
        });

        OG.runCommand("(reset-actors 'life)");
        level.cellUpdates = [];
        level.buzzerUpdates = [];
        level.orbUpdates = [];
        level.crateUpdates = [];
    }




    // ----- collection logic ----- | these are stored here instead of being methods of their own type so we don't have to Object.assign() every collectable
    
    private setCollectedBuzzer(buzzer: BuzzerBase) {
        if (buzzer.parentEname.startsWith("crate-"))
            OG.runCommand('safe-kill-crate-buzzer "' + buzzer.parentEname + '"');
    }

    private setCollectedOrb(orb: OrbBase, kill: boolean) {
        if (orb.parentEname.startsWith("orb-cache-top-"))
            OG.runCommand('safe-kill-cache-orb "' + orb.parentEname + '"');
        else if (orb.parentEname.startsWith("crate-"))
            OG.runCommand('safe-kill-crate-orb "' + orb.parentEname + '"');
        else {
            OG.runCommand('(process-entity-status! (the-as money (process-by-ename "' + orb.ename + '")) (entity-perm-status dead) #t)');
            if (kill)
                OG.runCommand('(kill-by-name "' + orb.ename + '" *active-pool*)');
        }
    }

    private destroyCrate(crate: CrateBase) {
        OG.runCommand('(safe-break-crate "' + crate.ename + '"');
    }
}