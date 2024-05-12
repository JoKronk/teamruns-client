import { UserInteractionData } from "./interaction-data";

export class ShortMemoryInteraction {
    interaction: UserInteractionData;
    teamId: number;
    reciveTimeMs: number;

    constructor(interaction: UserInteractionData, teamId: number, timeMs: number) {
        this.interaction = interaction;
        this.teamId = teamId;
        this.reciveTimeMs = timeMs;
    }
}