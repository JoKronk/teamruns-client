import { DbTask } from "../firestore/db-task";
import { Timer } from "../run/timer";
import { InteractionData } from "../socket/interaction-data";
import { GameTaskLevelTime } from "./game-task";
import { InteractionType } from "./interaction-type";
import { TaskStatus } from "./task-status";

export class Task {
    gameTask: string;
    isCollectedCell: boolean;
    obtainedByName: string;
    obtainedById: string;
    obtainedAtMs: number;
    obtainedAt: string;

    constructor(task: GameTaskLevelTime) {
        this.gameTask = task.name;
        this.isCollectedCell = Task.isCellCollect(task.name, task.status);
        this.obtainedById = task.user.id;
        this.obtainedByName = task.user.name;
        this.obtainedAtMs = task.timerTimeMs;
        this.obtainedAt = Timer.msToTimeFormat(task.timerTimeMs, true, true);
    }

    public static fromDbTask(task: DbTask): Task {
        return {
            gameTask: task.gameTask,
            isCollectedCell: task.isCell,
            obtainedByName: task.obtainedByName,
            obtainedById: task.obtainedById,
            obtainedAtMs: task.obtainedAtMs,
            obtainedAt: Timer.msToTimeFormat(task.obtainedAtMs, true, true)
        };
    }

    public static lastboss = "finalboss-movies";
    public static forfeit = "finalboss-forfeit";

    public static isRunEnd(interaction: InteractionData) {
        return interaction.interType === InteractionType.gameTask && (interaction.interName === Task.lastboss || interaction.interName === Task.forfeit) && TaskStatus.nameFromEnum(interaction.interStatus) === TaskStatus.unknown;
    }

    public static isCellCollect(name: string, status: string) {
        return this.resultsInCell(name) && status === TaskStatus.needResolution;
    }

    public static resultsInCell(gameTask: string) {
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


    public static cellCost(interaction: InteractionData) {
        if (interaction.interType !== InteractionType.gameTask || TaskStatus.nameFromEnum(interaction.interStatus) !== TaskStatus.needResolution) return 0;

        if (interaction.interName.includes("-oracle-money"))
            return 120;
        else if (interaction.interName.includes("-money"))
            return 90;
        else
            return 0;
    }

    public static isWarpGate(gameTask: string) {
        return ([
            "village2-levitator",
            "village3-button",
            "village4-button"
        ]).includes(gameTask);
    }

    public static generateIneractionForHubGate(hub: number) : InteractionData | undefined {
        switch(hub) {
            case 2:
                return {
                    interType: InteractionType.gameTask,
                    interAmount: 103,
                    interStatus: 4,
                    interName: "village2-levitator",
                    interParent: "entity-pool",
                    interLevel: "village2",
                    interCleanup: true,
                    time: 0
                }
            case 3:
                return {
                    interType: InteractionType.gameTask,
                    interAmount: 105,
                    interStatus: 3,
                    interName: "village3-button",
                    interParent: "entity-pool",
                    interLevel: "village3",
                    interCleanup: true,
                    time: 0
                }
            case 4:
                return {
                    interType: InteractionType.gameTask,
                    interAmount: 111,
                    interStatus: 6,
                    interName: "village4-button",
                    interParent: "entity-pool",
                    interLevel: "lavatube",
                    interCleanup: true,
                    time: 0
                }
            default:
                return undefined;
        }
    }

    public static nameFromEnum(task: number): string {
        if (task > 116) return "none";
        return([
        "none",
        "complete",
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
        "firecanyon-assistant",
        "village2-levitator",
        "swamp-arm",
        "village3-button",
        "red-eggtop",
        "lavatube-balls",
        "lavatube-start",
        "intro",
        "ogre-secret",
        "village4-button",
        "finalboss-movies",
        "plunger-lurker-hit",
        "leaving-misty",
        "assistant-village3",
        "max"][task]);
    }


    public static getTaskHub(taskName: string): number {
        switch (taskName) {
            case "training-gimmie":
            case "training-door":
            case "training-climb":
            case "training-buzzer":
            case "village1-yakow":
            case "village1-mayor-money":
            case "village1-uncle-money":
            case "village1-oracle-money1":
            case "village1-oracle-money2":
            case "village1-buzzer":
            case "jungle-eggtop":
            case "jungle-lurkerm":
            case "jungle-tower":
            case "jungle-fishgame":
            case "jungle-plant":
            case "jungle-buzzer":
            case "jungle-canyon-end":
            case "jungle-temple-door":
            case "beach-ecorocks":
            case "beach-pelican":
            case "beach-flutflut":
            case "beach-seagull":
            case "beach-cannon":
            case "beach-gimmie":
            case "beach-sentinel":
            case "beach-buzzer":
            case "misty-muse":
            case "misty-boat":
            case "misty-warehouse":
            case "misty-cannon":
            case "misty-bike":
            case "misty-buzzer":
            case "misty-bike-jump":
            case "misty-eco-challenge":
            case "firecanyon-buzzer":
            case "firecanyon-end":
                return 1;
            case "village2-gambler-money":
            case "village2-geologist-money":
            case "village2-warrior-money":
            case "village2-oracle-money1":
            case "village2-oracle-money2":
            case "village2-buzzer":
            case "swamp-billy":
            case "swamp-flutflut":
            case "swamp-battle":
            case "swamp-tether-1":
            case "swamp-tether-2":
            case "swamp-tether-3":
            case "swamp-tether-4":
            case "swamp-buzzer":
            case "sunken-platforms":
            case "sunken-pipe":
            case "sunken-slide":
            case "sunken-room":
            case "sunken-sharks":
            case "sunken-buzzer":
            case "sunken-top-of-helix":
            case "sunken-spinning-room":
            case "rolling-race":
            case "rolling-robbers":
            case "rolling-moles":
            case "rolling-plants":
            case "rolling-lake":
            case "rolling-buzzer":
            case "rolling-ring-chase-1":
            case "rolling-ring-chase-2":
            case "ogre-boss":
            case "ogre-secret":
            case "ogre-end":
            case "ogre-buzzer":
                return 2;
            case "village3-miner-money1":
            case "village3-miner-money2":
            case "village3-miner-money3":
            case "village3-miner-money4":
            case "village3-oracle-money1":
            case "village3-oracle-money2":
            case "village3-extra1":
            case "village3-buzzer":
            case "snow-eggtop":
            case "snow-ram":
            case "snow-fort":
            case "snow-ball":
            case "snow-bunnies":
            case "snow-buzzer":
            case "snow-bumpers":
            case "snow-cage":
            case "cave-gnawers":
            case "cave-dark-crystals":
            case "cave-dark-climb":
            case "cave-robot-climb":
            case "cave-swing-poles":
            case "cave-spider-tunnel":
            case "cave-platforms":
            case "cave-buzzer":
            case "lavatube-end":
            case "lavatube-buzzer":
                return 3;
            case "citadel-sage-blue":
            case "citadel-sage-red":
            case "citadel-sage-yellow":
            case "citadel-sage-green":
            case "citadel-buzzer":
            case "finalboss-movies":
                return 4;
            default:
                return 0;
        }
    }

    public static defaultSplitName(taskName: string): string | undefined {
            switch (taskName) {
                case "jungle-eggtop":
                    return "Blue Eco Vent";
                case "jungle-lurkerm":
                    return "Mirrors";
                case "jungle-tower":
                    return "Top of Tower";
                case "jungle-fishgame":
                    return "Fish";
                case "jungle-plant":
                    return "Plant Boss";
                case "jungle-buzzer":
                    return "FJ Flies";
                case "jungle-canyon-end":
                    return "Jungle Island";
                case "jungle-temple-door":
                    return "Jungle Locked Door";
                case "village1-yakow":
                    return "Yakows";
                case "village1-mayor-money":
                    return "Mayor Orbs";
                case "village1-uncle-money":
                    return "Uncle Orbs";
                case "village1-oracle-money1":
                    return "SV Oracle 1";
                case "village1-oracle-money2":
                    return "SV Oracle 2";
                case "beach-ecorocks":
                    return "Eco Cloggers";
                case "beach-pelican":
                    return "Pelican";
                case "beach-flutflut":
                    return "Birdlady";
                case "beach-seagull":
                    return "Seagulls";
                case "beach-cannon":
                    return "Beach Cannon";
                case "beach-buzzer":
                    return "Beach Flies";
                case "beach-gimmie":
                    return "Explore Beach";
                case "beach-sentinel":
                    return "Sentinel";
                case "misty-muse":
                    return "Muse";
                case "misty-boat":
                    return "Lurker Ship";
                case "misty-warehouse":
                    return "Misty Ambush";
                case "misty-cannon":
                    return "Misty Cannon";
                case "misty-bike":
                    return "Zepplins";
                case "misty-buzzer":
                    return "Misty Flies";
                case "misty-bike-jump":
                    return "Misty Ramp Jump";
                case "misty-eco-challenge":
                    return "Misty Boosted";
                case "village2-gambler-money":
                    return "Gambler Orbs";
                case "village2-geologist-money":
                    return "Geologist Orbs";
                case "village2-warrior-money":
                    return "Warrior Orbs";
                case "village2-oracle-money1":
                    return "RV Oracle 1";
                case "village2-oracle-money2":
                    return "RV Oracle 2";
                case "swamp-billy":
                    return "Rats";
                case "swamp-flutflut":
                    return "Boggy Flut Flut Cell";
                case "swamp-battle":
                    return "Boggy Ambush";
                case "swamp-tether-1":
                    return "Tether 2";
                case "swamp-tether-2":
                    return "Tether 3";
                case "swamp-tether-3":
                    return "Tether 4";
                case "swamp-tether-4":
                    return "Tether 1";
                case "swamp-buzzer":
                    return "Swamp Flies";
                case "sunken-platforms":
                    return "Puzzle Cell";
                case "sunken-pipe":
                    return "Pipe Cell";
                case "sunken-slide":
                    return "Bottom of LPC";
                case "sunken-room":
                    return "LPC Chamber";
                case "sunken-sharks":
                    return "LPC Boosted";
                case "sunken-buzzer":
                    return "LPC Flies";
                case "sunken-top-of-helix":
                    return "Piggyback";
                case "sunken-spinning-room":
                    return "LPC Dark Eco Pool";
                case "rolling-race":
                    return "DMG Race";
                case "rolling-robbers":
                    return "Purple Lurkers";
                case "rolling-moles":
                    return "Moles";
                case "rolling-plants":
                    return "Plants";
                case "rolling-lake":
                    return "Cell Over Lake";
                case "rolling-buzzer":
                    return "Basin Flies";
                case "rolling-ring-chase-1":
                    return "Purple Rings";
                case "rolling-ring-chase-2":
                    return "Blue Rings";
                case "snow-eggtop":
                    return "Yellow Eco Vent";
                case "snow-ram":
                    return "Snowy Shield Lurkers";
                case "snow-fort":
                    return "Fortress Cell";
                case "snow-ball":
                    return "Fortress Door";
                case "snow-bunnies":
                    return "Snowy Lurker Cave";
                case "snow-buzzer":
                    return "Snowy Flies";
                case "snow-bumpers":
                    return "Snowy Blockers";
                case "snow-cage":
                    return "Snowy Box";
                case "firecanyon-buzzer":
                    return "FC Flies";
                case "firecanyon-end":
                    return "Fire Canyon";
                case "citadel-sage-green":
                    return "Green Sage";
                case "citadel-sage-blue":
                    return "Blue Sage";
                case "citadel-sage-red":
                    return "Red Sage";
                case "citadel-sage-yellow":
                    return "Yellow Sage";
                case "village3-extra1":
                    return "VC Box";
                case "village1-buzzer":
                    return "SV Flies";
                case "village2-buzzer":
                    return "RV Flies";
                case "village3-buzzer":
                    return "VC Flies";
                case "cave-gnawers":
                    return "Gnawing Lurkers";
                case "cave-dark-crystals":
                    return "Dark Eco Crystals";
                case "cave-dark-climb":
                    return "Dark Cave";
                case "cave-robot-climb":
                    return "Top of Robot";
                case "cave-swing-poles":
                    return "Spider Poles";
                case "cave-spider-tunnel":
                    return "Spider Tunnel";
                case "cave-platforms":
                    return "Top of Spider Cave";
                case "cave-buzzer":
                    return "Spider Cave Flies";
                case "ogre-boss":
                    return "Klaww";
                case "ogre-end":
                    return "Mountain Pass";
                case "ogre-buzzer":
                    return "MP Flies";
                case "lavatube-end":
                    return "Lava Tube";
                case "lavatube-buzzer":
                    return "LT Flies";
                case "citadel-buzzer":
                    return "Citadel Flies";
                case "training-gimmie":
                    return "Geyser Path";
                case "training-door":
                    return "Geyser Door";
                case "training-climb":
                    return "Geyser Top";
                case "training-buzzer":
                    return "Geyser Flies";
                case "village3-miner-money1":
                    return "Miner Orbs 1";
                case "village3-miner-money2":
                    return "Miner Orbs 2";
                case "village3-miner-money3":
                    return "Miner Orbs 3";
                case "village3-miner-money4":
                    return "Miner Orbs 4";
                case "village3-oracle-money1":
                    return "VC Oracle 1";
                case "village3-oracle-money2":
                    return "VC Oracle 2";
                case "ogre-secret":
                    return "MP Secret Cell";
                case "finalboss-movies":
                    return "Final Boss";
                default:
                    return undefined;
            }
    }
}