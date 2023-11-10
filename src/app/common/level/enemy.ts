export class EnemyBase {
    ename: string;
    pickupAmount: number;

    constructor(ename: string, pickupAmount: number) {
        this.ename = ename;
        this.pickupAmount = pickupAmount;
    }
}