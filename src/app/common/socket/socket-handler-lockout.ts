import { NgZone } from "@angular/core";
import { Team } from "../run/team";
import { User } from "../user/user";
import { SocketHandler } from "./socket-handler";
import { CurrentPositionData } from "./current-position-data";
import { InteractionData, UserInteractionData } from "./interaction-data";
import { GameTaskLevelTime } from "../opengoal/game-task";
import { Task } from "../opengoal/task";
import { MultiplayerState } from "../opengoal/multiplayer-state";
import { TaskStatus } from "../opengoal/task-status";
import { Run } from "../run/run";
import { ConnectionHandler } from "../peer/connection-handler";

export class SocketHandlerLockout extends SocketHandler {

    
    constructor(socketPort: number, user: User, connectionHandler: ConnectionHandler, run: Run, zone: NgZone) {
        super(socketPort, user, connectionHandler, run, zone);
    }

    override onTask(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        
        const task: GameTaskLevelTime = GameTaskLevelTime.fromCurrentPositionData(positionData, interaction, isSelfInteraction ? this.user.displayName : playerTeam.players.find(x => x.user.id === interaction.userId)?.user.name ?? this.players.find(x => x.userId === interaction.userId)?.getCurrentUsername() ?? "Unknown");

        //set players to act as ghosts on run end
        if (Task.isRunEnd(interaction)) {
            const player = this.players.find(x => x.positionData.userId === positionData.userId);
            if (player) player.positionData.mpState = MultiplayerState.active;
        }

        const isCell: boolean = Task.isCellCollect(interaction.interName, TaskStatus.nameFromEnum(interaction.interStatus));
        const isNewTaskStatusForSelfTeam: boolean = this.localTeam?.runState.isNewTaskStatus(interaction) ?? false;

        let isNewTaskStatus: boolean = true;
        for (let team of this.run.teams) {
            if (!team.runState.isNewTaskStatus(interaction)) {
                isNewTaskStatus = false;
                break;
            }
        }

        if (isCell) { // end run split added in EndPlayerRun event
            if (this.run.isFFA ? !this.run.hasSplit(task.name) : isNewTaskStatus) {
                this.zone.run(() => {
                    this.run.addSplit(new Task(task));
                });
            }
            this.checkUpdateSplit(task);

            //open warp gate on new hub cell
            //!TODO: could probably been done cleaner than to generate one gate task per cell
            let gateTask = Task.generateIneractionForHubGate(Task.getTaskHub(task.name));
            if (gateTask && (this.localTeam?.runState.isNewTaskStatus(gateTask) ?? false))
                this.addSelfInteraction(gateTask);
        }

        this.updatePlayerInfo(positionData.userId, this.run.getRemotePlayerInfo(positionData.userId));
        
        if (isNewTaskStatusForSelfTeam && (this.isLocalMainPlayer || this.run.isFFA)) {
            if (!isTeammate && positionData.interaction) { //to not increase cell counter on add
                positionData.interaction.interCleanup = true;
                interaction.interCleanup = true;
            }
            //add to team run state
            this.localTeam?.runState.addTaskInteraction(interaction);

            //adjust orb count for local peers if cell with cost
            if (!this.run.isFFA && isCell && !interaction.interCleanup && Task.cellCost(interaction) !== 0) {
                for (let localPlayer of this.connectionHandler.localPeers) {
                    if (playerTeam.players.some(x => x.user.id === localPlayer.user.id && localPlayer.user.id !== positionData.userId))
                        localPlayer.socketHandler.addSelfInteraction(playerTeam.runState.generateOrbInteractionFromLevel());
                }
            }
    
            if (!isTeammate && positionData.interaction) { //reset afterwards to also give cell to player
                positionData.interaction.interCleanup = false;
                interaction.interCleanup = false;
            }
        }

        //add cleanup if interaction from other level
        if (!isSelfInteraction && isNewTaskStatusForSelfTeam)
            this.cleanupHandler.onInteraction(interaction);
    }
    
    override onBuzzer(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate)
            positionData.resetCurrentInteraction();
        
        super.onBuzzer(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onOrb(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {

        if (this.localTeam?.runState.isFalseOrb(interaction)) {
            positionData.resetCurrentInteraction();
            return;
        }

        //could be written a lot smaller but I'm keeping it like this for a better readability
        if (!isTeammate) {
            if (this.run.teams.length !== 1) { //2+ teams, player interaction from enemy team
                super.onOrb(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                this.removeOrbWithoutOrbCounter(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
            } 
            else { //1 team (FFA), not self
                if (positionData.interaction)
                    positionData.interaction.interCleanup = true;
                interaction.interCleanup = true;

                super.onOrb(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
                this.removeOrbWithoutOrbCounter(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
            }
        }

        else if (!isSelfInteraction) { //2+ teams, interaction from teammate
            super.onOrb(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
        }

        else {
            if (this.run.teams.length !== 1) { //2+ teams, self interaction
                super.onOrb(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
            } 
            else { //1 team (FFA), self interaction
                super.onOrb(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
            }
        }
                
    }

    override onEco(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        super.onEco(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onFish(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate)
            positionData.resetCurrentInteraction();
        else
            super.onFish(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onBossPhase(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate)
            positionData.resetCurrentInteraction();
        else
            super.onBossPhase(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onCrate(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (!isTeammate && InteractionData.isBuzzerCrate(interaction))
            positionData.resetCurrentInteraction();
        else
            super.onCrate(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onEnemyDeath(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        super.onEnemyDeath(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onPeriscope(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        super.onPeriscope(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onSnowBumper(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        super.onSnowBumper(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onDarkCrystal(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        super.onDarkCrystal(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }
    
    override onLpcChamber(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        super.onLpcChamber(positionData, interaction, isSelfInteraction, playerTeam, isTeammate);
    }


    private removeOrbWithoutOrbCounter(positionData: CurrentPositionData, interaction: UserInteractionData, isSelfInteraction: boolean, playerTeam: Team, isTeammate: boolean) {
        if (positionData.interaction)
            positionData.interaction.interCleanup = true;
        interaction.interCleanup = true;
        
        if (!isSelfInteraction)
            this.cleanupHandler.onInteraction(interaction);
    }

}