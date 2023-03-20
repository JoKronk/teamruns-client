export class Level {
    static lavaTube = "lavatube";
    static beach = "beach";
    static citadel = "citadel";
    static darkCave = "darkcave";
    static finalBoss = "finalboss";
    static fireCanyon = "firecanyon";
    static jungle = "jungle";
    static plantBoss = "jungleb";
    static spiderCave = "maincave";
    static misty = "misty";
    static mountainPass = "ogre";
    static spiderRobotCave = "robocave";
    static basin = "rolling";
    static snowy = "snow";
    static lpcTopPart = "sunken";
    static lpcBottomPart = "sunkenb";
    static boggy = "swamp";
    static geyser = "training";
    static hub1 = "village1";
    static hub2 = "village2";
    static hub3 = "village3";
}

export class MultiLevel {
    static spiderCave(): string[] {
        return [ Level.spiderCave, Level.spiderRobotCave, Level.darkCave];
    }

    static jungle(): string[] {
        return [ Level.jungle, Level.plantBoss];
    }

    static lpc(): string[] {
        return [ Level.lpcTopPart, Level.lpcBottomPart];
    }
}