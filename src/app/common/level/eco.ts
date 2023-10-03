export class EcoBase {
    ename: string;
    parentEname: string;

    constructor(ename: string, parentEname: string) {
        this.ename = ename;
        this.parentEname = parentEname;
    }
}

export class Eco extends EcoBase {
    level: string;

    constructor(base: EcoBase, level: string) {
        super(base.ename, base.parentEname);
        this.level = level;
    }
}