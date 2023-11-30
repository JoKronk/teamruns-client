import { InteractionType } from "../opengoal/interaction-type";
import { Task } from "../opengoal/task";
import { TaskStatus } from "../opengoal/task-status";
import { InteractionData, UserInteractionData } from "../playback/interaction-data";
import { Crate } from "./crate";
import { LevelInteractions } from "./level-interactions";

export class RunStateHandler {
    levels: LevelInteractions[] = [];

    ////unused in LevelHandler
    tasksStatuses: UserInteractionData[];
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

    isNewTaskStatus(interaction: InteractionData): boolean {
        if (interaction.interType !== InteractionType.gameTask) return false;

        return !this.tasksStatuses.some(x => x.interName === interaction.interName) || this.tasksStatuses.find(x => x.interName === interaction.interName)!.interAmount < interaction.interAmount;
    }

    hasAtleastTaskStatus(taskName: string, status: string): boolean {
        return this.tasksStatuses.some(x => x.interName === taskName) && this.tasksStatuses.find(x => x.interName === taskName)!.interAmount >= TaskStatus.getEnumValue(status);
    }

    private pushLevelCleanupInteraction(level: LevelInteractions, interaction: UserInteractionData) {
        const storedInteraction = new UserInteractionData(interaction, interaction.userId);
        storedInteraction.interCleanup = true;
        level.interactions.push(storedInteraction);
    }

    addTaskInteraction(interaction: UserInteractionData) {
        //update general task status
        let oldTaskStatus = this.tasksStatuses.find(x => x.interName === interaction.interName);
        if (oldTaskStatus)
            this.tasksStatuses[this.tasksStatuses.indexOf(oldTaskStatus)] = interaction;
        else
            this.tasksStatuses.push(interaction);

        //add task status for level
        const level = this.getCreateLevel(interaction.interLevel);
        this.pushLevelCleanupInteraction(level, interaction);

        //update counts
        const status: string = TaskStatus.nameFromEnum(interaction.interAmount);
        if (Task.isCellCollect(interaction.interName, status)) {
            this.cellCount += 1;
            this.orbCount -= Task.cellCost(interaction);
        }
    }

    addInteraction(interaction: UserInteractionData) {
        const level = this.getCreateLevel(interaction.interLevel);
        this.pushLevelCleanupInteraction(level, interaction);
    }

    addLpcInteraction(interaction: UserInteractionData) {
        const level = this.getCreateLevel(interaction.interLevel);
        level.interactions = level.interactions.filter(x => x.interType !== InteractionType.lpcChamber);
        this.pushLevelCleanupInteraction(level, interaction);
    }

    addBuzzerInteraction(interaction: UserInteractionData) {
        const level = this.getCreateLevel(interaction.interLevel);
        this.pushLevelCleanupInteraction(level, interaction);
        this.buzzerCount += 1;
    }

    addOrbInteraction(interaction: UserInteractionData, level: LevelInteractions | undefined = undefined) {
        if (!level)
            level = this.getCreateLevel(interaction.interLevel);
    
        this.pushLevelCleanupInteraction(level, interaction);
        this.orbCount += 1;
    }


    getCreateLevel(levelName: string): LevelInteractions {
        let level = this.levels.find(x => x.levelName === levelName);
        if (!level) {
            level = new LevelInteractions(levelName);
            this.levels.push(level);
        }
        return level;
    }


    isOrbDupe(interaction: InteractionData, level: LevelInteractions | undefined = undefined): boolean {
        if (!level)
            level = this.getCreateLevel(interaction.interLevel);
        if (interaction.interParent.startsWith("orb-cache-top-"))
            return 15 < (level.interactions.filter(x => x.interType === InteractionType.money && x.interParent === interaction.interParent).length + 1);
        else if (interaction.interParent.startsWith("crate-")) {
            let parentCrate = level.interactions.find(x => Crate.isOrbsType(x.interType) && x.interName === interaction.interParent);
            if (parentCrate) 
                return parentCrate.interAmount < (level.interactions.filter(x => x.interType === InteractionType.money && x.interParent === interaction.interParent).length + 1);
            return false;
        }
        else if (interaction.interParent.startsWith("gnawer-")) {
            let parentGnawer = level.interactions.find(x => x.interType === InteractionType.enemyDeath && x.interName === interaction.interParent);
            if (parentGnawer) 
                return parentGnawer.interAmount < (level.interactions.filter(x => x.interType === InteractionType.money && x.interParent === interaction.interParent).length + 1);
            return false;
        }
        else if (interaction.interParent.startsWith("plant-boss-"))
            return 5 < (level.interactions.filter(x => x.interType === InteractionType.money && x.interParent === interaction.interParent).length + 1);
        else {
            return level.interactions.find(x => x.interType === InteractionType.money && x.interName === interaction.interName) !== undefined; 
        }
    }
}