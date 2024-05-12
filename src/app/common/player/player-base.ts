import { UserBase } from "../user/user";
import { PlayerType } from "./player-type";

export class PlayerBase {
    user: UserBase;
    type: PlayerType;

    constructor(user: UserBase, type: PlayerType) {
        this.user = user;
        this.type = type;
    }
}