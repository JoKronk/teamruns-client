
export class OrbValidation {
    entityName: string;
    collectedByIds: string[] | null; //null = collected by all

    constructor(name: string, collector: string) {
        this.entityName = name;
        this.collectedByIds = [collector];
    }

    isOrbDupe(userId: string): boolean {
        return this.collectedByIds === null || this.collectedByIds.includes(userId);
    }

    addOrbCollection(playerIds: string[], userId: string) {
        let collectedByAll: boolean = true;

        if (!this.collectedByIds) return; //already collected by everyone
        
        for (let playerId of playerIds) {
            if (playerId !== userId && !this.collectedByIds?.includes(playerId)) {
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