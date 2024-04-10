import { Player } from "../player/player";

export class OrbCollection {
    entityName: string;
    collectedByIds: string[] | null; //null = collected by all

    constructor(name: string, collector: string) {
        this.entityName = name;
        this.collectedByIds = [collector];
    }

    isOrbDupe(userId: string): boolean {
        return this.collectedByIds === null || this.collectedByIds.includes(userId);
    }

    addOrbCollection(players: Player[], userId: string) {
        let collectedByAll: boolean = true;

        if (!this.collectedByIds) return; //already collected by everyone
        
        for (let player of players) {
            if (player.user.id !== userId && !this.collectedByIds?.includes(player.user.id)) {
                collectedByAll = false;
                break;
            }
        }

        if (collectedByAll)
            this.collectedByIds = null;
        else if (!this.collectedByIds.includes(userId))
            this.collectedByIds.push(userId);

        return;
    }
}