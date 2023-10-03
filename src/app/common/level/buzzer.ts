export class BuzzerBase {
    id: number;
    parentEname: string;

    constructor(id: number, parentEname: string) {
        this.id = id;
        this.parentEname = parentEname;
    }
}

export class Buzzer extends BuzzerBase {
    level: string;

    constructor(base: BuzzerBase, level: string) {
        super(base.id, base.parentEname);
        this.level = level;
    }
}