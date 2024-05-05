import { UserBase } from "../user/user";

export class DbUserProfile {
    id: string;
    name: string;

    constructor(user: UserBase) {
        this.id =  user.id ?? crypto.randomUUID();
        this.name = user.name;
    }
}