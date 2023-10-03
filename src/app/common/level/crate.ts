export class CrateBase {
    ename: string;
    type: string;
    pickupAmount: number;

    constructor(ename: string, type: string, pickupAmount: number) {
        this.ename = ename;
        this.type = type;
        this.pickupAmount = pickupAmount;
    }
}

export class Crate extends CrateBase {
    level: string;

    constructor(base: CrateBase, level: string) {
        super(base.ename, base.type, base.pickupAmount);
        this.level = level;
    }

    public static typeWithBuzzer = "iron";
    public static typeWithOrbs = "steel";
}