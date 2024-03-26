import { UserBase } from "../user/user";
import { RunStateHandler } from "./run-state-handler";

export class LocalSave extends RunStateHandler {
    name: string;
    users: UserBase[];

    constructor() {
        super();
    }
}