export class CrateBase {
    ename: string;
    type: string;
    pickupAmount: number;

    constructor(crate: Crate) {
        this.ename = crate.ename;
        this.type = crate.type;
        this.pickupAmount = crate.pickupAmount;
    }
}

export class Crate extends CrateBase {
    level: string;


    public static typeWithBuzzer = "iron";
    public static typeWithOrbs = "steel";
}