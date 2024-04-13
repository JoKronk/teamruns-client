import { Task } from "../opengoal/task";
import { LevelStatus } from "./level-status";
import { RunStateHandler } from "./run-state-handler";
import { Level } from "../opengoal/levels";
import { SocketHandler } from "../socket/socket-handler";
import { InteractionData, UserInteractionData } from "../socket/interaction-data";
import { InteractionType } from "../opengoal/interaction-type";
import { TaskStatus } from "../opengoal/task-status";
import { OgCommand } from "../socket/og-command";
import { GameState } from "../opengoal/game-state";
import { SyncType } from "./sync-type";

export class RunCleanupHandler extends RunStateHandler {

    constructor() {
        super();
    }

    importRunState(runStateHandler: RunStateHandler, socketHandler: SocketHandler, gameState: GameState, syncType: SyncType) {
        
        this.resetHandler();

        //reset game
        if (syncType === SyncType.Full) socketHandler.addCommand(OgCommand.ResetGame);

        //import task statuses to game
        runStateHandler.tasksStatuses.forEach(interaction => {
            const modifiedInteraction = interaction;
            modifiedInteraction.interCleanup = true;
            this.resendCommonInteraction(modifiedInteraction, socketHandler);
        });

        if (syncType >= SyncType.Hard) {
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
                        if (gameState.buzzerCount === 0) //re give all scoutflies if restart
                            interaction.interCleanup = false;
                        this.resendCommonInteraction(interaction, socketHandler);
                    });
                }, 500);
            });
        }
        
        const orbAdjustCount = runStateHandler.orbCount - gameState.orbCount;
        socketHandler.addOrbAdjustmentToCurrentPlayer(orbAdjustCount);
    }

    private resendCommonInteraction(interaction: UserInteractionData, socketHandler: SocketHandler) {
        socketHandler.addPlayerInteraction(interaction);
        this.onInteraction(interaction);
    }
    

    // ----- update handlers -----


    onInteraction(interaction: UserInteractionData) {
        
        if (!this.levelIsLoaded(interaction.interLevel))
        {
            switch (interaction.interType)
            {
                case InteractionType.gameTask:
                    this.addTaskInteraction(interaction);
                    break;
                case InteractionType.crate:
                    if ((InteractionData.isBuzzerCrate(interaction) || InteractionData.isOrbsCrate(interaction)))
                        this.addInteraction(interaction);
                    break;
                default:
                    this.addInteraction(interaction);
                    break;

            }
        }
    }

    onLpcChamberStop(interaction: UserInteractionData) {
        if (!this.levelIsLoaded(Level.hub2) && !this.levelIsLoaded(Level.lpcBottomPart))
            this.addLpcInteraction(interaction);
    }


    override onLevelsUpdate(levels: LevelStatus[], socketHandler: SocketHandler): void {
        super.onLevelsUpdate(levels, socketHandler);
        this.getLoadedLevels().forEach(level => {
            this.onLevelActive(level.name, socketHandler);
        });
    }

    private onLevelActive(levelName: string, socketHandler: SocketHandler) {

        setTimeout(() => {
            let level = this.levels.find(x => x.levelName === levelName);
            if (!level || level.interactions.length === 0 ) 
                return;

            console.log("killing from level", level);
            level.interactions.filter(x => x.interType == InteractionType.crate).forEach(interaction => {
                socketHandler.addPlayerInteraction(interaction);
            });

            level.interactions.filter(x => x.interType == InteractionType.enemyDeath).forEach(interaction => {
                socketHandler.addPlayerInteraction(interaction);
            });

            const buzzerUpdates = level!.interactions.filter(x => x.interType == InteractionType.buzzer);
            setTimeout(() => { //give time for buzzer crate to get destoryed
                buzzerUpdates.forEach((interaction, index) => {
                    // cheap way of marking that this is the last buzzer and pickup should be ran on it.
                    if (index + 1 === buzzerUpdates.length && interaction.interName === "buzzer") 
                        interaction.interName = "buzzer-last"; //!TODO: does produce a cell spawn bug on enter if the last fly is a lpc minigame one
                        
                    socketHandler.addPlayerInteraction(interaction);
                    this.buzzerCount -= 1;
                });
            }, 500);

            level.interactions.filter(x => x.interType == InteractionType.money).forEach(interaction => {
                socketHandler.addPlayerInteraction(interaction);
                this.orbCount -= 1;
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
                    this.cellCount -= 1; 
            });
    
            level.interactions = [];
        }, 1500);
    }



}