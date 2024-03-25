import { Task } from "../opengoal/task";
import { LevelStatus } from "./level-status";
import { RunStateHandler } from "./run-state-handler";
import { Level } from "../opengoal/levels";
import { SocketHandler } from "../socket/socket-handler";
import { InteractionData, UserInteractionData } from "../socket/interaction-data";
import { InteractionType } from "../opengoal/interaction-type";
import { TaskStatus } from "../opengoal/task-status";
import { OgCommand } from "../socket/og-command";

export class LevelHandler {

    uncollectedLevelItems: RunStateHandler = new RunStateHandler();
    levels: LevelStatus[] = [];

    constructor() {

    }

    importRunStateHandler(runStateHandler: RunStateHandler, socketHandler: SocketHandler, orbCount: number, hardReset: boolean) {
        
        this.uncollectedLevelItems = new RunStateHandler();

        //reset game
        if (hardReset) socketHandler.addCommand(OgCommand.ResetGame);

        //import task statuses to game
        runStateHandler.tasksStatuses.forEach(interaction => {
            this.resendCommonInteraction(interaction, socketHandler);
        });

        //update collectables
        runStateHandler.levels.forEach(level => {

            level.interactions.filter(x => x.interType == InteractionType.crate).forEach(interaction => {
                this.resendCommonInteraction(interaction, socketHandler);
            });

            level.interactions.filter(x => x.interType == InteractionType.money).forEach(interaction => {
                this.resendCommonInteraction(interaction, socketHandler);
            });

            level.interactions.filter(x => x.interType == InteractionType.enemyDeath).forEach(interaction => {
                this.resendCommonInteraction(interaction, socketHandler);
            });

            level.interactions.filter(x => x.interType == InteractionType.periscope).forEach(interaction => {
                this.resendCommonInteraction(interaction, socketHandler);
            });

            level.interactions.filter(x => x.interType == InteractionType.snowBumper).forEach(interaction => {
                this.resendCommonInteraction(interaction, socketHandler);
            });

            level.interactions.filter(x => x.interType == InteractionType.darkCrystal).forEach(interaction => {
                this.resendCommonInteraction(interaction, socketHandler);
            });
            
            level.interactions.filter(x => x.interType == InteractionType.lpcChamber).forEach(interaction => {
                socketHandler.addPlayerInteraction(interaction);
                this.onLpcChamberStop(interaction);
            });

            setTimeout(() => { //give time for buzzer crate to get destoryed
                level.interactions.filter(x => x.interType == InteractionType.buzzer).forEach(interaction => {
                    this.resendCommonInteraction(interaction, socketHandler);
                });
            }, 500);
        
            const orbAdjustCount = runStateHandler.orbCount - orbCount;
            socketHandler.addOrbAdjustmentToCurrentPlayer(orbAdjustCount);
        });
    }

    private resendCommonInteraction(interaction: UserInteractionData, socketHandler: SocketHandler) {
        socketHandler.addPlayerInteraction(interaction);
        this.onInteraction(interaction);
    }
    

    // ----- update handlers -----

    onLevelsUpdate(levels: LevelStatus[], socketHandler: SocketHandler) {
        this.levels = levels;
        this.levels.forEach(level => {
            if (level.status === LevelStatus.Active || level.status === LevelStatus.Alive)
                this.onLevelActive(level.name, socketHandler);
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
                case InteractionType.crate:
                    if ((InteractionData.isBuzzerCrate(interaction) || InteractionData.isOrbsCrate(interaction)))
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

    private onLevelActive(levelName: string, socketHandler: SocketHandler) {

        setTimeout(() => {
            let level = this.uncollectedLevelItems.levels.find(x => x.levelName === levelName);
            if (!level || level.interactions.length === 0 ) 
                return;

            console.log("killing from level", level);
            level.interactions.filter(x => x.interType == InteractionType.crate).forEach(interaction => {
                socketHandler.addPlayerInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.enemyDeath).forEach(interaction => {
                socketHandler.addPlayerInteraction(interaction);
            });


            setTimeout(() => { //give time for buzzer crate to get destoryed
                const buzzerUpdates = level!.interactions.filter(x => x.interType == InteractionType.buzzer);
                buzzerUpdates.forEach((interaction, index) => {
                    // cheap way of marking that this is the last buzzer and pickup should be ran on it.
                    if (index + 1 === buzzerUpdates.length && interaction.interName == "buzzer") 
                        interaction.interName = "buzzer-last"; //!TODO: does produce a cell spawn bug on enter if the last fly is a lpc minigame one
                        
                    socketHandler.addPlayerInteraction(interaction);
                    this.uncollectedLevelItems.buzzerCount -= 1;
                });
            }, 500);

            level.interactions.filter(x => x.interType == InteractionType.money).forEach(interaction => {
                socketHandler.addPlayerInteraction(interaction);
                this.uncollectedLevelItems.orbCount -= 1;
            });

            level.interactions.filter(x => x.interType == InteractionType.periscope).forEach(interaction => {
                socketHandler.addPlayerInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.snowBumper).forEach(interaction => {
                socketHandler.addPlayerInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.darkCrystal).forEach(interaction => {
                socketHandler.addPlayerInteraction(interaction);
            });
            
            level.interactions.filter(x => x.interType == InteractionType.lpcChamber).forEach(interaction => {
                socketHandler.addPlayerInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.gameTask).forEach(interaction => {
                socketHandler.addPlayerInteraction(interaction);
                if (Task.isCellCollect(interaction.interName, TaskStatus.nameFromEnum(interaction.interStatus)))
                    this.uncollectedLevelItems.cellCount -= 1; 
            });
    
            level.interactions = [];
        }, 1500);
    }



}