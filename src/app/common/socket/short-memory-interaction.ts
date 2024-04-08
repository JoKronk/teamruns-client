import { UserInteractionData } from "./interaction-data";

export class ShortMemoryInteraction {
    interaction: UserInteractionData;
    reciveTimeMs: number;

    constructor(interaction: UserInteractionData, timeMs: number) {
        this.interaction = interaction;
        this.reciveTimeMs = timeMs;
    }
}