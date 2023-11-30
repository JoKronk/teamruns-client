import { OG } from "../opengoal/og";
import { Task } from "../opengoal/task";
import { LevelStatus } from "./level-status";
import { Crate } from "./crate";
import { RunStateHandler } from "./run-state-handler";
import { Level } from "../opengoal/levels";
import { PositionHandler } from "../playback/position-handler";
import { UserInteractionData } from "../playback/interaction-data";
import { InteractionType } from "../opengoal/interaction-type";
import { TaskStatus } from "../opengoal/task-status";

export class LevelHandler {

    uncollectedLevelItems: RunStateHandler = new RunStateHandler();
    levels: LevelStatus[] = [];

    constructor() {

    }

    importRunStateHandler(runStateHandler: RunStateHandler, positionHandler: PositionHandler, teamPlayerCheckpoint: string | null = null) {

        //reset game
        OG.runCommand("(initialize! *game-info* 'game (the-as game-save #f) (the-as string #f))");

        //import task statuses to game
        runStateHandler.tasksStatuses.forEach(interaction => {
            this.onInteraction(interaction);
            if (Task.isCellCollect(interaction.interName, TaskStatus.nameFromEnum(interaction.interAmount))) {
                const cost = Task.cellCost(interaction);
                if (cost !== 0)
                    positionHandler.addOrbReductionToCurrentPlayer(cost, interaction.interLevel);
            }
        });
          
        OG.runCommand("(reset-actors 'life)");


        //update collectables
        runStateHandler.levels.forEach(level => {

            level.interactions.filter(x => x.interType == InteractionType.crateNormal || x.interType == InteractionType.crateIron || x.interType == InteractionType.crateSteel || x.interType == InteractionType.crateDarkeco).forEach(interaction => {
                this.onInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.buzzer).forEach(interaction => {
                this.onInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.money).forEach(interaction => {
                this.onInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.enemyDeath).forEach(interaction => {
                this.onInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.periscope).forEach(interaction => {
                this.onInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.snowBumper).forEach(interaction => {
                this.onInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.darkCrystal).forEach(interaction => {
                this.onInteraction(interaction);
            });
            
            level.interactions.filter(x => x.interType == InteractionType.lpcChamber).forEach(interaction => {
                this.onLpcChamberStop(interaction);
            });

        });
        //tp to first team player checkpoint
        if (teamPlayerCheckpoint)
            OG.runCommand("(start 'play (get-continue-by-name *game-info* " + teamPlayerCheckpoint + "))");
    }
    

    // ----- update handlers -----

    onLevelsUpdate(levels: LevelStatus[], positionHandler: PositionHandler) {
        this.levels = levels;
        this.levels.forEach(level => {
            if (level.status === LevelStatus.Active || level.status === LevelStatus.Alive)
                this.onLevelActive(level.name, positionHandler);
        });
    }


    onInteraction(interaction: UserInteractionData) {
        if (!this.levelIsActive(interaction.interLevel))
        {
            switch (interaction.interType)
            {
                case InteractionType.gameTask:
                    this.uncollectedLevelItems.addTaskInteraction(interaction);
                    break;
                case InteractionType.crateNormal:
                case InteractionType.crateIron:
                case InteractionType.crateSteel:
                case InteractionType.crateDarkeco:
                    if ((Crate.isBuzzerType(interaction.interType) || Crate.isOrbsType(interaction.interType)))
                        this.uncollectedLevelItems.addInteraction(interaction);
                    break;
                default:
                    this.uncollectedLevelItems.addInteraction(interaction);
                    break;

            }
        }
    }

    onLpcChamberStop(interaction: UserInteractionData) {
        if (!this.levelIsActive(Level.hub2) && !this.levelIsActive(Level.lpcBottomPart))
            this.uncollectedLevelItems.addLpcInteraction(interaction);
    }



    // ----- internal methods -----

    public levelIsActive(levelName: string): boolean {
        let level = this.levels.find(x => x.name === levelName);
        if (!level)
            return false;
        return level.status === LevelStatus.Active || level.status === LevelStatus.Alive;
    }

    private onLevelActive(levelName: string, positionHandler: PositionHandler) {

        setTimeout(() => {
            let level = this.uncollectedLevelItems.levels.find(x => x.levelName === levelName);
            if (!level || level.interactions.length === 0 ) 
                return;



            console.log("killing from level", level)

            level.interactions.filter(x => x.interType == InteractionType.crateNormal || x.interType == InteractionType.crateIron || x.interType == InteractionType.crateSteel || x.interType == InteractionType.crateDarkeco).forEach(interaction => {
                positionHandler.addPlayerInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.enemyDeath).forEach(interaction => {
                positionHandler.addPlayerInteraction(interaction);
            });

            const buzzerUpdates = level.interactions.filter(x => x.interType == InteractionType.buzzer);
            buzzerUpdates.forEach((interaction, index) => {
                // cheap way of marking that this is the last buzzer and pickup should be ran on it.
                if (index + 1 === buzzerUpdates.length && interaction.interName == "buzzer") 
                    interaction.interName = "buzzer-last"; //!TODO: does produce a cell spawn bug on enter if the last fly is a lpc minigame one
                    
                positionHandler.addPlayerInteraction(interaction);
                this.uncollectedLevelItems.buzzerCount -= 1;
            });

            level.interactions.filter(x => x.interType == InteractionType.money).forEach(interaction => {
                positionHandler.addPlayerInteraction(interaction);
                this.uncollectedLevelItems.orbCount -= 1;
            });

            level.interactions.filter(x => x.interType == InteractionType.periscope).forEach(interaction => {
                positionHandler.addPlayerInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.snowBumper).forEach(interaction => {
                positionHandler.addPlayerInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.darkCrystal).forEach(interaction => {
                positionHandler.addPlayerInteraction(interaction);
            });
            
            level.interactions.filter(x => x.interType == InteractionType.lpcChamber).forEach(interaction => {
                positionHandler.addPlayerInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.gameTask).forEach(interaction => {
                positionHandler.addPlayerInteraction(interaction);
                if (Task.isCellCollect(interaction.interName, TaskStatus.nameFromEnum(interaction.interAmount)))
                    this.uncollectedLevelItems.cellCount -= 1; 
            });
    
            level.interactions = [];
        }, 1500);
    }



}