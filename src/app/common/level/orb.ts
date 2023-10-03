export class OrbBase {
    ename: string;
    parentEname: string;

    constructor(ename: string, parentEname: string) {
        this.ename = ename;
        this.parentEname = parentEname;
    }
}

export class Orb extends OrbBase {
    level: string;

    constructor(base: OrbBase, level: string) {
        super(base.ename, base.parentEname);
        this.level = level;
    }
}