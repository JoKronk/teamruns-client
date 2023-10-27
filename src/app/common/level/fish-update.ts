import { InteractionType } from "../opengoal/interaction-type";

export class FishUpdate {
    type: InteractionType;
    amount: number;

    constructor(type: InteractionType, amount: number) {
        this.type = type;
        this.amount = amount;
    }
}