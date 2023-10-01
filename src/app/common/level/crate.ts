export class CrateBase {
    ename: string;
    type: string;

    constructor(crate: Crate) {
        this.ename = crate.ename;
        this.type = crate.type;
    }
}

export class Crate extends CrateBase {
    level: string;
}