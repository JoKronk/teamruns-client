export class BuzzerBase {
    parentEname: string;
    id: number;

    constructor(buzzer: Buzzer) {
        this.parentEname = buzzer.parentEname;
        this.id = buzzer.id;
    }
}

export class Buzzer extends BuzzerBase {
    level: string;
}