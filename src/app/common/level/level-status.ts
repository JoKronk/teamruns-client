export class LevelStatus {
    name: string;
    status: string;

    constructor(name: string, status: string) {
        this.name = name;
        this.status = status;
    }

    public static DisplayedBase = "display"; //!NOTE: There's serveral 'display-' types, might be good to check for starts with Displayed
    public static SpecialVis = "special-vis";
    public static Special = "special";
    public static Deloaded = "#f";
}