import { UserBase } from "../user/user";

export class LobbyUser extends UserBase {
    isRunner: boolean;

    constructor(user: UserBase, runner: boolean = false) {
        super(user.id, user.name);
        this.isRunner = runner;
    }
}