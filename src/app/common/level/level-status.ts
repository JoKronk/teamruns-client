export class LevelStatus {
    name: string;
    status: string;

    constructor(name: string, status: string) {
        this.name = name;
        this.status = status;
    }

    public static Active = "active";
    public static Alive = "alive";
    public static Loaded = "loaded";
    public static Deactive = "deactive";
}