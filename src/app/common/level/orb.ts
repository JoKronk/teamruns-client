export class OrbBase {
    ename: string;
    parentEname: string;

    constructor(orb: Orb) {
        this.ename = orb.ename;
        this.parentEname = orb.parentEname;
    }
}

export class Orb extends OrbBase {
    level: string;
}