import { InteractionType } from "../opengoal/interaction-type";
import { Task } from "../opengoal/task";
import { TaskStatus } from "../opengoal/task-status";
import { Player } from "../player/player";
import { InteractionData, UserInteractionData } from "../socket/interaction-data";
import { LevelInteractions } from "./level-interactions";
import { OrbCollection } from "./orb-collection";

export class RunStateHandler {
    levels: LevelInteractions[] = [];

    ////unused in LevelHandler (only used for team instance)
    tasksStatuses: UserInteractionData[];
    cellCount: number;
    buzzerCount: number;
    orbCount: number;
    orbValidations: OrbCollection[]; //handles orb validation orb collection for all/each player of the team
    //single orbs: could otherwise more easily be duped by picking up the same one at the same time and such
    //orb vents and such: if we just check by orb count and p1 picks up the last orb the orb count will be completed but p2 won't now know if the orb he's getting is a duped orb or the last one for him

    constructor() {
        this.levels = [];
        this.tasksStatuses = [];
        this.cellCount = 0;
        this.buzzerCount = 0;
        this.orbCount = 0;
        this.orbValidations = [];
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

    addInteraction(interaction: UserInteractionData, level: LevelInteractions | undefined = undefined) {
        if (!level)
            level = this.getCreateLevel(interaction.interLevel);

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

    checkDupeAddOrbInteraction(players: Player[], userId: string, interaction: UserInteractionData): boolean {
        const level = this.getCreateLevel(interaction.interLevel);
        let alreadyCollected: boolean = false;
    
        //single orb check
        if (interaction.interName.startsWith("money-")) {
            let entity = this.getOrbCollection(interaction.interName);
            if (entity) {
                alreadyCollected = true;
                if (entity.isOrbDupe(userId))
                    return true;
            }
            entity ? entity.addOrbCollection(players, userId) : this.orbValidations.push(new OrbCollection(interaction.interName, userId)); //add orb collection
        }
        //orb collection checks
        else if ((interaction.interName === "money" || interaction.interName === "") || interaction.interParent !== undefined) {
            alreadyCollected = this.getOrbCollection(interaction.interName) !== undefined;
            if (interaction.interParent.startsWith("orb-cache-top-")) {
                if (this.checkDupeAddOrbGroupInteraction(players, userId, interaction.interParent, this.getOrbCacheAmount(interaction.interParent) <= level.interactions.filter(x => x.interType === InteractionType.money && x.interParent === interaction.interParent).length))
                    return true;    
            }
    
            else if (interaction.interParent.startsWith("crate-")) {
                let parentCrate = level.interactions.find(x => InteractionData.isOrbsCrate(x) && x.interName === interaction.interParent);
                if (this.checkDupeAddOrbGroupInteraction(players, userId, interaction.interParent, parentCrate !== undefined && parentCrate.interAmount <= level.interactions.filter(x => x.interType === InteractionType.money && x.interParent === interaction.interParent).length))
                    return true;
            }
    
            else if (interaction.interParent.startsWith("gnawer-")) {
                let parentGnawer = level.interactions.find(x => x.interType === InteractionType.enemyDeath && x.interName === interaction.interParent);
                if (this.checkDupeAddOrbGroupInteraction(players, userId, interaction.interParent, parentGnawer !== undefined && parentGnawer.interAmount <= level.interactions.filter(x => x.interType === InteractionType.money && x.interParent === interaction.interParent).length))
                    return true;
            }
    
            else if (interaction.interParent.startsWith("plant-boss-")) {
                if (this.checkDupeAddOrbGroupInteraction(players, userId, interaction.interParent, 5 <= level.interactions.filter(x => x.interType === InteractionType.money && x.interParent === interaction.interParent).length))
                    return true;
            }
        }
        
        if (userId === interaction.userId) {
            this.pushLevelCleanupInteraction(level, interaction);

            if (!alreadyCollected && !interaction.interCleanup)
                this.orbCount += 1;
        }

        return false;
    }

    private getOrbCollection(entityName: string): OrbCollection | undefined {
        return this.orbValidations.find(x => x.entityName === entityName);
    }

    private checkDupeAddOrbGroupInteraction(players: Player[], userId: string, entityName: string, isLastOrb: boolean): boolean {
        const entity: OrbCollection | undefined = this.getOrbCollection(entityName);
        if (entity && entity.isOrbDupe(userId))
            return true;

        if (isLastOrb) //add orb collection
            entity ? entity.addOrbCollection(players, userId) : this.orbValidations.push(new OrbCollection(entityName, userId));
        
        return false;
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