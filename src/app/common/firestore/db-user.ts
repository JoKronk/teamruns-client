import { User } from "../user/user";

export class DbUser {
    id: string;
    name: string;
    displayName: string;

    constructor(user: User) {
        this.id =  user.id;
        this.name = user.name;
        this.displayName = user.displayName;
    }
}