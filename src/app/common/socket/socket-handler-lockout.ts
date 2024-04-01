import { NgZone } from "@angular/core";
import { LevelHandler } from "../level/level-handler";
import { Team } from "../run/team";
import { User } from "../user/user";
import { SocketHandler } from "./socket-handler";
import { Timer } from "../run/timer";
import { CurrentPositionData } from "./current-position-data";
import { InteractionData, UserInteractionData } from "./interaction-data";
import { GameTaskLevelTime } from "../opengoal/game-task";
import { Task } from "../opengoal/task";
import { MultiplayerState } from "../opengoal/multiplayer-state";
import { TaskStatus } from "../opengoal/task-status";
import { Run } from "../run/run";

export class SocketHandlerLockout extends SocketHandler {

    
    constructor(socketPort: number, user: User, run: Run, levelHandler: LevelHandler, zone: NgZone) {
        super(socketPort, user, run, levelHandler, zone);
    }

    override onTask(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

        const task: GameTaskLevelTime = GameTaskLevelTime.fromCurrentPositionData(positionData, interaction);
        
        //check duped cell buy
        if (isSelfInteraction && Task.isCellWithCost(task.name) && this.localTeam && this.localTeam.runState.hasAtleastTaskStatus(interaction.interName, TaskStatus.needResolution)) {
            this.addOrbAdjustmentToCurrentPlayer((Task.cellCost(interaction)), interaction.interLevel);
            return;
        }

        //set players to act as ghosts on run end
        if (Task.isRunEnd(interaction)) {
            const player = this.players.find(x => x.positionData.userId === positionData.userId);
            if (player) player.positionData.mpState = MultiplayerState.active;
        }

        const isCell: boolean = Task.isCellCollect(interaction.interName, TaskStatus.nameFromEnum(interaction.interStatus));
        const isNewTaskStatusForSelfTeam: boolean = this.localTeam?.runState.isNewTaskStatus(interaction) ?? false;
        
        let isNewTaskStatus: boolean = true;
        this.run.teams.forEach(team => {
            if (!team.runState.isNewTaskStatus(interaction)) {
                isNewTaskStatus = false;
                return;
            }
        });

        if (isCell && (this.run.isFFA ? !this.run.hasSplit(task.name) : isNewTaskStatus)) { // end run split added in EndPlayerRun event
            this.zone.run(() => {
                this.run.addSplit(new Task(task));
            });
        }
        this.updatePlayerInfo(positionData.userId, this.run.getRemotePlayerInfo(positionData.userId));

        //handle none current user things
        if (!isSelfInteraction) {

            //task updates
            if (isNewTaskStatusForSelfTeam)
                this.levelHandler.onInteraction(interaction);

            //cell cost check
            if (isCell && isTeammate && !interaction.interCleanup && Task.cellCost(interaction) !== 0)
                this.addOrbAdjustmentToCurrentPlayer(-(Task.cellCost(interaction)), interaction.interLevel);
        }

        if (!isNewTaskStatusForSelfTeam) return;

        if (!isTeammate && positionData.interaction) { //to not increase cell counter on add
            positionData.interaction.interCleanup = true;
            interaction.interCleanup = true;
        }
        //add to team run state
        this.localTeam?.runState.addTaskInteraction(interaction);

        if (!isTeammate && positionData.interaction) { //reset afterwards to also give cell to player
            positionData.interaction.interCleanup = false;
            interaction.interCleanup = false;
        }
    }
    
    override onBuzzer(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate)
            positionData.resetCurrentInteraction();
        
        super.onBuzzer(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onOrb(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

        if (this.localTeam?.runState.isFalseOrb(interaction)) {
            positionData.resetCurrentInteraction();
            return;
        }

        //could be written a lot smaller but I'm keeping it like this for a better readability
        if (!isTeammate) {
            if (this.run.teams.length !== 1) { //2+ teams, player interaction from enemy team
                if (positionData.interaction) {
                    positionData.interaction.interCleanup = true;
                    interaction.interCleanup = true;
                }
                
                super.onOrb(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                this.removeOrbWithoutOrbCounter(positionData, userId, interaction, isSelfInteraction);
            } 
            else { //1 team (FFA), not self
                if (positionData.interaction) {
                    positionData.interaction.interCleanup = true;
                    interaction.interCleanup = true;
                }
                super.onOrb(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
                this.removeOrbWithoutOrbCounter(positionData, userId, interaction, isSelfInteraction);
            }
        }

        else if (!isSelfInteraction) { //2+ teams, interaction from teammate
            super.onOrb(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
        }

        else {
            if (this.run.teams.length !== 1) { //2+ teams, self interaction
                super.onOrb(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
            } 
            else { //1 team (FFA), self interaction
                super.onOrb(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
            }
        }
                
    }

    override onEco(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate)
            positionData.resetCurrentInteraction();
        else
            super.onEco(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onFish(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate)
            positionData.resetCurrentInteraction();
        else
            super.onFish(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onBossPhase(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate)
            positionData.resetCurrentInteraction();
        else
            super.onBossPhase(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onCrate(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate && InteractionData.isBuzzerCrate(interaction))
            positionData.resetCurrentInteraction();
        else
            super.onCrate(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onEnemyDeath(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate)
            positionData.resetCurrentInteraction();
        else
            super.onEnemyDeath(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onPeriscope(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate)
            positionData.resetCurrentInteraction();
        else
            super.onPeriscope(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onSnowBumper(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate)
            positionData.resetCurrentInteraction();
        else
            super.onSnowBumper(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onDarkCrystal(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate)
            positionData.resetCurrentInteraction();
        else
            super.onDarkCrystal(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onLpcChamber(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate)
            positionData.resetCurrentInteraction();
        else
            super.onLpcChamber(positionData, userId, interaction, isSelfInteraction, playerTeam, isTeammate);
    }


    private removeOrbWithoutOrbCounter(positionData: CurrentPositionData, userId: string, interaction: UserInteractionData, isSelfInteraction: boolean) {
        if (positionData.interaction) {
            positionData.interaction.interCleanup = true;
            interaction.interCleanup = true;
        }

        if (this.localTeam?.runState.checkDupeAddOrbInteraction(this.localTeam.players, userId, true, interaction)) {
            if (isSelfInteraction)
                this.addOrbAdjustmentToCurrentPlayer(-1, interaction.interLevel);
        }
        
        if (!isSelfInteraction)
            this.levelHandler.onInteraction(interaction);
    }

}