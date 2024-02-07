import { InteractionType } from "../opengoal/interaction-type";
import { Task } from "../opengoal/task";
import { TaskStatus } from "../opengoal/task-status";
import { InteractionData, UserInteractionData } from "../socket/interaction-data";
import { LevelInteractions } from "./level-interactions";

export class RunStateHandler {
    levels: LevelInteractions[] = [];

    ////unused in LevelHandler
    tasksStatuses: UserInteractionData[];
    cellCount: number;
    buzzerCount: number;
    orbCount: number;

    //exists to mark when all orbs are collected from a collection of orbs,
    //since if we just check by orb count and p1 picks up the last orb the orb count will be completed but p2 won't now know if the orb he's getting is a duped orb or the last one
    completedOrbGroups: string[]; 

    constructor() {
        this.levels = [];
        this.tasksStatuses = [];
        this.cellCount = 0;
        this.buzzerCount = 0;
        this.orbCount = 0;
        this.completedOrbGroups = [];
    }

    isNewTaskStatus(interaction: InteractionData): boolean {
        if (interaction.interType !== InteractionType.gameTask) return false;

        return !this.tasksStatuses.some(x => x.interName === interaction.interName) || this.tasksStatuses.find(x => x.interName === interaction.interName)!.interStatus < interaction.interStatus;
    }

    hasAtleastTaskStatus(taskName: string, status: string): boolean {
        return this.tasksStatuses.some(x => x.interName === taskName) && this.tasksStatuses.find(x => x.interName === taskName)!.interStatus >= TaskStatus.getEnumValue(status);
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
        const status: string = TaskStatus.nameFromEnum(interaction.interStatus);
        if (Task.isCellCollect(interaction.interName, status) && !interaction.interCleanup) {
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
        if (!interaction.interCleanup)
            this.buzzerCount += 1;
    }

    addOrbInteraction(interaction: UserInteractionData, level: LevelInteractions | undefined = undefined) {
        if (!level)
            level = this.getCreateLevel(interaction.interLevel);
    
        this.pushLevelCleanupInteraction(level, interaction);

        if (interaction.interParent.startsWith("orb-cache-top-")) {
            if (this.completedOrbGroups.includes(interaction.interParent)) return;

            if (this.getOrbCacheAmount(interaction.interParent) <= (level.interactions.filter(x => x.interType === InteractionType.money && x.interParent === interaction.interParent).length))
                this.completedOrbGroups.push(interaction.interParent);
        }

        else if (interaction.interParent.startsWith("crate-")) {
            if (this.completedOrbGroups.includes(interaction.interParent)) return;

            let parentCrate = level.interactions.find(x => InteractionData.isOrbsCrate(x.interType) && x.interName === interaction.interParent);
            if (parentCrate && parentCrate.interAmount <= (level.interactions.filter(x => x.interType === InteractionType.money && x.interParent === interaction.interParent).length))
                this.completedOrbGroups.push(interaction.interParent);
        }

        else if (interaction.interParent.startsWith("gnawer-")) {
            if (this.completedOrbGroups.includes(interaction.interParent)) return;

            let parentGnawer = level.interactions.find(x => x.interType === InteractionType.enemyDeath && x.interName === interaction.interParent);
            if (parentGnawer && parentGnawer.interAmount <= (level.interactions.filter(x => x.interType === InteractionType.money && x.interParent === interaction.interParent).length))
                this.completedOrbGroups.push(interaction.interParent);
        }

        else if (interaction.interParent.startsWith("plant-boss-")) {
            if (this.completedOrbGroups.includes(interaction.interParent)) return;

            if (5 <= (level.interactions.filter(x => x.interType === InteractionType.money && x.interParent === interaction.interParent).length))
                this.completedOrbGroups.push(interaction.interParent);
        }

        if (!interaction.interCleanup)
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


    isFalseOrb(interaction: UserInteractionData): boolean {
        return interaction.interType === InteractionType.money && interaction.interName === "money" && interaction.interParent === "entity-pool" && interaction.interLevel === "none";
    }

    isOrbDupeFromCollection(interaction: UserInteractionData, level: LevelInteractions | undefined = undefined): boolean {
        if (!level)
            level = this.getCreateLevel(interaction.interLevel);

        return (interaction.interName === "money" || interaction.interName === "") && interaction.interParent !== undefined && this.completedOrbGroups.includes(interaction.interParent);
    }

    isOrbDupe(interaction: UserInteractionData, level: LevelInteractions | undefined = undefined): boolean {
        if (!level)
            level = this.getCreateLevel(interaction.interLevel);

        if (this.isOrbDupeFromCollection(interaction, level))
            return true;
        else if (interaction.interName.startsWith("money-")) {
            return level.interactions.find(x => x.interType === InteractionType.money && x.interName === interaction.interName && x.userId !== interaction.userId) !== undefined; 
        }
        return false;
    }

    private getOrbCacheAmount(name: string) {
        switch (name) {
            case "orb-cache-top-31": //citadel
            case "orb-cache-top-32":
            case "orb-cache-top-33":
                return 30;
            case "orb-cache-top-7": //jungle
            case "orb-cache-top-14": //village2
                return 20;
            case "orb-cache-top-4": //sandover
            case "orb-cache-top-15": //misty
            case "orb-cache-top-28": //snowy
            case "orb-cache-top-29":
            case "orb-cache-top-30":
                return 15;
            case "orb-cache-top-24": //beach
            case "orb-cache-top-25":
            case "orb-cache-top-26": //lpc
            case "orb-cache-top-27":
                return 10;
            default:
                return 15;
        }
    }
}