import { Level } from "./level";

export class Checkpoint {
    gameCheckpoint: string;
    gameLevel: string;
    levelName: string;
    name: string;

    constructor(gameLevel: string, gameCheckpoint: string, displayName: string) {
        this.gameCheckpoint = gameCheckpoint;
        this.name = displayName;
        this.gameLevel = gameLevel;
        this.levelName = Level.getDisplayName(gameLevel);
    }

    static getAll(): Checkpoint[] {
        let checkpoints: Checkpoint[] = [];
        checkpoints.push(new Checkpoint(Level.geyser, "training-start", "Start"));
        checkpoints.push(new Checkpoint(Level.geyser, "training-warp", "Portal"));
        checkpoints.push(new Checkpoint(Level.hub1, "village1-hut", "Start"));
        checkpoints.push(new Checkpoint(Level.hub1, "village1-warp", "Portal"));
        checkpoints.push(new Checkpoint(Level.beach, "beach-start", "Start"));
        checkpoints.push(new Checkpoint(Level.jungle, "jungle-start", "Start"));
        checkpoints.push(new Checkpoint(Level.plantBoss, "jungle-tower", "Temple"));
        checkpoints.push(new Checkpoint(Level.misty, "misty-start", "Start"));
        checkpoints.push(new Checkpoint(Level.misty, "misty-silo", "Before Arena"));
        checkpoints.push(new Checkpoint(Level.misty, "misty-bike", "Bike"));
        checkpoints.push(new Checkpoint(Level.misty, "misty-backside", "Bike Other Side"));
        checkpoints.push(new Checkpoint(Level.misty, "misty-silo2", "After Arena"));
        checkpoints.push(new Checkpoint(Level.fireCanyon, "firecanyon-start", "Start"));
        checkpoints.push(new Checkpoint(Level.fireCanyon, "firecanyon-end", "End"));
        checkpoints.push(new Checkpoint(Level.hub2, "village2-start", "Start"));
        checkpoints.push(new Checkpoint(Level.hub2, "village2-warp", "Portal"));
        checkpoints.push(new Checkpoint(Level.hub2, "village2-dock", "Docks"));
        checkpoints.push(new Checkpoint(Level.lpcTopPart, "sunken-start", "Start"));
        checkpoints.push(new Checkpoint(Level.lpcTopPart, "sunken1", "Before Pipe Room"));
        checkpoints.push(new Checkpoint(Level.lpcTopPart, "sunken2", "Middle"));
        checkpoints.push(new Checkpoint(Level.lpcTopPart, "sunken-tube1", "Slide"));
        checkpoints.push(new Checkpoint(Level.lpcBottomPart, "sunkenb-start", "Chamber"));
        checkpoints.push(new Checkpoint(Level.lpcBottomPart, "sunkenb-helix", "Bottom"));
        checkpoints.push(new Checkpoint(Level.boggy, "swamp-start", "Start"));
        checkpoints.push(new Checkpoint(Level.boggy, "swamp-dock1", "Tether 1"));
        checkpoints.push(new Checkpoint(Level.boggy, "swamp-cave1", "Cave 1"));
        checkpoints.push(new Checkpoint(Level.boggy, "swamp-dock2", "Tether 2"));
        checkpoints.push(new Checkpoint(Level.boggy, "swamp-cave2", "Ambush"));
        checkpoints.push(new Checkpoint(Level.boggy, "swamp-game", "Rats"));
        checkpoints.push(new Checkpoint(Level.boggy, "swamp-cave3", "Tether 4"));
        checkpoints.push(new Checkpoint(Level.basin, "rolling-start", "Start"));
        checkpoints.push(new Checkpoint(Level.mountainPass, "ogre-start", "Klaww"));
        checkpoints.push(new Checkpoint(Level.mountainPass, "ogre-race", "Start"));
        checkpoints.push(new Checkpoint(Level.mountainPass, "ogre-end", "End"));
        checkpoints.push(new Checkpoint(Level.hub3, "village3-start", "Start"));
        checkpoints.push(new Checkpoint(Level.hub3, "village3-warp", "Portal"));
        checkpoints.push(new Checkpoint(Level.hub3, "village3-farside", "Gondola"));
        checkpoints.push(new Checkpoint(Level.snowy, "snow-start", "Gondola"));
        checkpoints.push(new Checkpoint(Level.snowy, "snow-fort", "Inside Fort"));
        checkpoints.push(new Checkpoint(Level.snowy, "snow-flut-flut", "Flut Flut"));
        checkpoints.push(new Checkpoint(Level.snowy, "snow-pass-to-fort", "Middle"));
        checkpoints.push(new Checkpoint(Level.snowy, "snow-by-ice-lake", "Secret Cell"));
        checkpoints.push(new Checkpoint(Level.snowy, "snow-by-ice-lake-alt", "Ice Lake"));
        checkpoints.push(new Checkpoint(Level.snowy, "snow-outside-fort", "Outside Fort"));
        checkpoints.push(new Checkpoint(Level.snowy, "snow-outside-cave", "Yellow Vent"));
        checkpoints.push(new Checkpoint(Level.snowy, "snow-across-from-flut", "Flut Flut Bridge"));
        checkpoints.push(new Checkpoint(Level.spiderCave, "maincave-start", "Start"));
        checkpoints.push(new Checkpoint(Level.spiderCave, "maincave-to-darkcave", "To Dark Cave"));
        checkpoints.push(new Checkpoint(Level.spiderCave, "maincave-to-robocave", "To Robot Room"));
        checkpoints.push(new Checkpoint(Level.darkCave, "darkcave-start", "Dark Cave Start"));
        checkpoints.push(new Checkpoint(Level.spiderRobotCave, "robocave-start", "Robot Start"));
        checkpoints.push(new Checkpoint(Level.spiderRobotCave, "robocave-bottom", "Robot Bottom"));
        checkpoints.push(new Checkpoint(Level.lavaTube, "lavatube-start", "Start"));
        checkpoints.push(new Checkpoint(Level.lavaTube, "lavatube-middle", "Middle 1"));
        checkpoints.push(new Checkpoint(Level.lavaTube, "lavatube-after-ribbon", "Middle 2"));
        checkpoints.push(new Checkpoint(Level.lavaTube, "lavatube-end", "End"));
        checkpoints.push(new Checkpoint(Level.citadel, "citadel-start", "Start"));
        checkpoints.push(new Checkpoint(Level.citadel, "citadel-entrance", "Outside"));
        checkpoints.push(new Checkpoint(Level.citadel, "citadel-warp", "Portal"));
        checkpoints.push(new Checkpoint(Level.citadel, "citadel-launch-start", "Yellow Sage Start"));
        checkpoints.push(new Checkpoint(Level.citadel, "citadel-launch-end", "Yellow Sage End"));
        checkpoints.push(new Checkpoint(Level.citadel, "citadel-plat-start", "Blue Sage Start"));
        checkpoints.push(new Checkpoint(Level.citadel, "citadel-plat-end", "Blue Sage End"));
        checkpoints.push(new Checkpoint(Level.citadel, "citadel-generator-start", "Red Sage Start"));
        checkpoints.push(new Checkpoint(Level.citadel, "citadel-generator-end", "Red Sage End"));
        checkpoints.push(new Checkpoint(Level.citadel, "citadel-elevator", "Elevator"));
        checkpoints.push(new Checkpoint(Level.finalBoss, "finalboss-start", "Elevator"));
        checkpoints.push(new Checkpoint(Level.finalBoss, "finalboss-fight", "Fight"));
    return checkpoints;
    }
}