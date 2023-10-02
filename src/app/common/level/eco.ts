export class EcoBase {
    ename: string;
    parentEname: string;

    constructor(orb: Eco) {
        this.ename = orb.ename;
        this.parentEname = orb.parentEname;
    }
}

export class Eco extends EcoBase {
    level: string;
}