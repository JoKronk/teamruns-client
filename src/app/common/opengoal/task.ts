import { UserBase } from "../user/user";
import { GameTask } from "./game-task";
import { Level } from "./levels";
import { TaskStatus } from "./task-status";

export class Task {
    gameTask: string;
    isCell: boolean;
    obtainedByName: string;
    obtainedById: string;
    obtainedAt: string;

    constructor(task: GameTask) {
        this.gameTask = task.name;
        this.isCell = Task.isCell(task.name);
        this.obtainedById = task.user.id;
        this.obtainedByName = task.user.name;
        this.obtainedAt = task.timerTime;
    }

    public static lastboss = "finalboss-movies";
    public static forfeit = "finalboss-forfeit";

    public static getCellEname(task: string): string | undefined {
        return new Map([
            ["training-gimmie", "fuel-cell-55"],
            ["training-door", "fuel-cell-53"],
            ["training-climb", "fuel-cell-54"],
            ["beach-gimmie", "fuel-cell-40"],
            ["beach-sentinel", "fuel-cell-42"],
            ["jungle-canyon-end", "fuel-cell-46"],
            ["jungle-temple-door", "fuel-cell-49"],
            ["jungle-tower", "fuel-cell-1"],
            ["misty-warehouse", "fuel-cell-11"],
            ["misty-boat", "fuel-cell-12"],
            ["misty-bike-jump", "fuel-cell-51"],
            ["misty-eco-challenge", "fuel-cell-50"],
            ["rolling-lake", "fuel-cell-45"],
            ["sunken-platforms", "fuel-cell-24"],
            ["sunken-sharks", "fuel-cell-26"],
            ["sunken-top-of-helix", "fuel-cell-25"],
            ["sunken-spinning-room", "fuel-cell-52"],
            ["swamp-flutflut", "fuel-cell-15"],
            ["ogre-secret", "fuel-cell-62"],
            ["snow-fort", "fuel-cell-30"],
            ["snow-bunnies", "fuel-cell-28"],
            ["cave-platforms", "fuel-cell-60"],
            ["cave-dark-climb", "fuel-cell-59"],
            ["cave-spider-tunnel", "fuel-cell-58"],
            ["cave-robot-climb", "fuel-cell-57"],
            ["cave-swing-poles", "fuel-cell-56"],
        ]).get(task);
    }

    public static getCellLevelByEname(ename: string): string | undefined {
        return new Map([
            ["fuel-cell-55", Level.geyser],
            ["fuel-cell-53", Level.geyser],
            ["fuel-cell-54", Level.geyser],
            ["fuel-cell-40", Level.beach],
            ["fuel-cell-42", Level.beach],
            ["fuel-cell-46", Level.jungle],
            ["fuel-cell-49", Level.jungle],
            ["fuel-cell-1", Level.jungle],
            ["fuel-cell-11", Level.misty],
            ["fuel-cell-12", Level.misty],
            ["fuel-cell-51", Level.misty],
            ["fuel-cell-50", Level.misty],
            ["fuel-cell-45", Level.basin],
            ["fuel-cell-24", Level.lpcTopPart],
            ["fuel-cell-26", "sunken-sharks"],
            ["fuel-cell-25", "sunken-top-of-helix"],
            ["fuel-cell-52", Level.lpcTopPart],
            ["fuel-cell-15", Level.boggy],
            ["fuel-cell-62", Level.mountainPass],
            ["fuel-cell-30", Level.snowy],
            ["fuel-cell-28", Level.snowy],
            ["fuel-cell-60", Level.spiderCave,],
            ["fuel-cell-59", Level.darkCave],
            ["fuel-cell-58", Level.spiderRobotCave],
            ["fuel-cell-57", Level.spiderRobotCave],
            ["fuel-cell-56", Level.spiderRobotCave]
        ]).get(ename);
    }

    public static isRunEnd(task: GameTask) {
        return task.status === TaskStatus.unknown && (task.name === Task.lastboss || task.name === Task.forfeit);
    }

    public static isCellCollect(task: GameTask) {
        return this.isCell(task.name) && task.status === TaskStatus.needResolution;
    }

    public static isCell(gameTask: string) {
        return ([
            "jungle-eggtop",
            "jungle-lurkerm",
            "jungle-tower",
            "jungle-fishgame",
            "jungle-plant",
            "jungle-buzzer",
            "jungle-canyon-end",
            "jungle-temple-door",
            "village1-yakow",
            "village1-mayor-money",
            "village1-uncle-money",
            "village1-oracle-money1",
            "village1-oracle-money2",
            "beach-ecorocks",
            "beach-pelican",
            "beach-flutflut",
            "beach-seagull",
            "beach-cannon",
            "beach-buzzer",
            "beach-gimmie",
            "beach-sentinel",
            "misty-muse",
            "misty-boat",
            "misty-warehouse",
            "misty-cannon",
            "misty-bike",
            "misty-buzzer",
            "misty-bike-jump",
            "misty-eco-challenge",
            "village2-gambler-money",
            "village2-geologist-money",
            "village2-warrior-money",
            "village2-oracle-money1",
            "village2-oracle-money2",
            "swamp-billy",
            "swamp-flutflut",
            "swamp-battle",
            "swamp-tether-1",
            "swamp-tether-2",
            "swamp-tether-3",
            "swamp-tether-4",
            "swamp-buzzer",
            "sunken-platforms",
            "sunken-pipe",
            "sunken-slide",
            "sunken-room",
            "sunken-sharks",
            "sunken-buzzer",
            "sunken-top-of-helix",
            "sunken-spinning-room",
            "rolling-race",
            "rolling-robbers",
            "rolling-moles",
            "rolling-plants",
            "rolling-lake",
            "rolling-buzzer",
            "rolling-ring-chase-1",
            "rolling-ring-chase-2",
            "snow-eggtop",
            "snow-ram",
            "snow-fort",
            "snow-ball",
            "snow-bunnies",
            "snow-buzzer",
            "snow-bumpers",
            "snow-cage",
            "firecanyon-buzzer",
            "firecanyon-end",
            "citadel-sage-green",
            "citadel-sage-blue",
            "citadel-sage-red",
            "citadel-sage-yellow",
            "village3-extra1",
            "village1-buzzer",
            "village2-buzzer",
            "village3-buzzer",
            "cave-gnawers",
            "cave-dark-crystals",
            "cave-dark-climb",
            "cave-robot-climb",
            "cave-swing-poles",
            "cave-spider-tunnel",
            "cave-platforms",
            "cave-buzzer",
            "ogre-boss",
            "ogre-end",
            "ogre-buzzer",
            "lavatube-end",
            "lavatube-buzzer",
            "citadel-buzzer",
            "training-gimmie",
            "training-door",
            "training-climb",
            "training-buzzer",
            "village3-miner-money1",
            "village3-miner-money2",
            "village3-miner-money3",
            "village3-miner-money4",
            "village3-oracle-money1",
            "village3-oracle-money2",
            "ogre-secret"
        ]).includes(gameTask);
    }


    public static isCellWithCost(gameTask: string) {
        return ([
            "village1-mayor-money",
            "village1-uncle-money",
            "village1-oracle-money1",
            "village1-oracle-money2",
            "village2-gambler-money",
            "village2-geologist-money",
            "village2-warrior-money",
            "village2-oracle-money1",
            "village2-oracle-money2",
            "village3-miner-money1",
            "village3-miner-money2",
            "village3-miner-money3",
            "village3-miner-money4",
            "village3-oracle-money1",
            "village3-oracle-money2"
        ]).includes(gameTask);
    }


    public static isWarpGate(gameTask: string) {
        return ([
            "village2-levitator",
            "village3-button",
            "village4-button"
        ]).includes(gameTask);
    }
}