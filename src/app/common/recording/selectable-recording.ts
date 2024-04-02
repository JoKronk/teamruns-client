import { Recording } from "./recording";

export class SelectableRecording extends Recording {
    selected: boolean = true;

    constructor(userId: string) {
        super(userId);
    }
}