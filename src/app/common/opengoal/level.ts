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
    
    static getDisplayName(levelName: string | undefined) {
        switch(levelName) {      
            case Level.lavaTube:
                return "Lavatube";
            case Level.beach:
                return "Beach";
            case Level.citadel:
                return "Citadel";
            case Level.darkCave:
                return "Spider Cave";
            case Level.finalBoss:
                return "Final Boss";
            case Level.fireCanyon:
                return "Fire Canyon";
            case Level.jungle:
                return "FJ";
            case Level.plantBoss:
                return "FJ";
            case Level.spiderCave:
                return "Spider Cave";
            case Level.misty:
                return "Misty";
            case Level.mountainPass:
                return "Mountain Pass";
            case Level.spiderRobotCave:
                return "Spider Cave";
            case Level.basin:
                return "Basin";
            case Level.snowy:
                return "Snowy";
            case Level.lpcTopPart:
                return "LPC";
            case Level.lpcBottomPart:
                return "LPC";
            case Level.boggy:
                return "Boggy";
            case Level.geyser:
                return "Geyser";
            case Level.hub1:
                return "Sandover";
            case Level.hub2:
                return "Rock Village";
            case Level.hub3:
                return "Volcanic Crater";
            default:
                return "";
        }
    }

    static toSymbol(levelName: string | undefined) {
        switch(levelName) {      
            case Level.lavaTube:        // lavatube
                return 1325164;
            case Level.beach:           // beach
                return 1312924;
            case Level.citadel:         // citadel
                return 1338444;
            case Level.darkCave:        // darkcave
                return 1433092;
            case Level.finalBoss:       // finalboss
                return 1340092;
            case Level.fireCanyon:      // firecanyon
                return 1321092;
            case Level.jungle:          // jungle
                return 1314348;
            case Level.plantBoss:       // jungleb
                return 1410548;
            case Level.spiderCave:      // maincave
                return 1347564;
            case Level.misty:           // misty
                return 1399604;
            case Level.mountainPass:    // ogre
                return 1403380;
            case Level.spiderRobotCave: // robocave
                return 1358164;
            case Level.basin:           // rolling
                return 1399012;
            case Level.snowy:           // snow
                return 1409380;
            case Level.lpcTopPart:      // sunken
                return 1348316;
            case Level.lpcBottomPart:   // sunkenb
                return 1430476;
            case Level.boggy:           // swamp
                return 1329836;
            case Level.geyser:          // training
                return 1334388;
            case Level.hub1:            // village1
                return 1428580;
            case Level.hub2:            // village2
                return 1428612;
            case Level.hub3:            // village3
                return 1428596;
            default:
                return "";
        }
    }
}

export class LevelSymbol {
    static lavaTube = 1325164;
    static beach = 1312924;
    static citadel = 1338444;
    static darkCave = 1433092;
    static finalBoss = 1340092;
    static fireCanyon = 1321092;
    static jungle = 1314348;
    static plantBoss = 1410548;
    static spiderCave = 1347564;
    static misty = 1399604;
    static mountainPass = 1403380;
    static spiderRobotCave = 1358164;
    static basin = 1399012;
    static snowy = 1409380;
    static lpcTopPart = 1348316;
    static lpcBottomPart = 1430476;
    static boggy = 1329836;
    static geyser = 1334388;
    static hub1 = 1428580;
    static hub2 = 1428612;
    static hub3 = 1428596;

    static toName(levelSymbol: number | undefined) {
        switch(levelSymbol) {
            case 1325164:
                return Level.lavaTube;
            case 1312924:
                return Level.beach;
            case 1338444:
                return Level.citadel;
            case 1433092:
                return Level.darkCave;
            case 1340092:
                return Level.finalBoss;
            case 1321092:
                return Level.fireCanyon;
            case 1314348:
                return Level.jungle;
            case 1410548:
                return Level.plantBoss;
            case 1347564:
                return Level.spiderCave;
            case 1399604:
                return Level.misty;
            case 1403380:
                return Level.mountainPass;
            case 1358164:
                return Level.spiderRobotCave;
            case 1399012:
                return Level.basin;
            case 1409380:
                return Level.snowy;
            case 1348316:
                return Level.lpcTopPart;
            case 1430476:
                return Level.lpcBottomPart;
            case 1329836:
                return Level.boggy;
            case 1334388:
                return Level.geyser;
            case 1428580:
                return Level.hub1;
            case 1428612:
                return Level.hub2;
            case 1428596:
                return Level.hub3;
            default:
                return "";
        }
    }
}

export class MultiLevel {
    static getLevels(levelName: string): string[] {
        switch(levelName) {      
            case Level.lavaTube:
                return [Level.lavaTube];
            case Level.beach:
                return [Level.beach];
            case Level.citadel:
            case Level.finalBoss:
                return [Level.citadel, Level.finalBoss];
            case Level.darkCave:
            case Level.spiderCave:
            case Level.spiderRobotCave:
                return [Level.darkCave, Level.spiderCave, Level.spiderRobotCave];
            case Level.fireCanyon:
                return [Level.fireCanyon];
            case Level.jungle:
            case Level.plantBoss:
                return [Level.jungle, Level.plantBoss];
            case Level.misty:
                return [Level.misty];
            case Level.mountainPass:
                return [Level.mountainPass];
            case Level.basin:
                return [Level.basin];
            case Level.snowy:
                return [Level.snowy];
            case Level.lpcTopPart:
            case Level.lpcBottomPart:
                return [Level.lpcTopPart, Level.lpcBottomPart];
            case Level.boggy:
                return [Level.boggy];
            case Level.geyser:
                return [Level.geyser];
            case Level.hub1:
                return [Level.hub1];
            case Level.hub2:
                return [Level.hub2];
            case Level.hub3:
                return [Level.hub3];
            default:
                return [];
        }
    }
    static getMainLevelName(levelName: string): string {
        switch(levelName) {      
            case Level.lavaTube:
                return Level.lavaTube;
            case Level.beach:
                return Level.beach;
            case Level.citadel:
            case Level.finalBoss:
                return Level.citadel;
            case Level.darkCave:
            case Level.spiderCave:
            case Level.spiderRobotCave:
                return Level.spiderCave;
            case Level.fireCanyon:
                return Level.fireCanyon;
            case Level.jungle:
            case Level.plantBoss:
                return Level.jungle;
            case Level.misty:
                return Level.misty;
            case Level.mountainPass:
                return Level.mountainPass;
            case Level.basin:
                return Level.basin;
            case Level.snowy:
                return Level.snowy;
            case Level.lpcTopPart:
            case Level.lpcBottomPart:
                return Level.lpcTopPart;
            case Level.boggy:
                return Level.boggy;
            case Level.geyser:
                return Level.geyser;
            case Level.hub1:
                return Level.hub1;
            case Level.hub2:
                return Level.hub2;
            case Level.hub3:
                return Level.hub3;
            default:
                return "none";
        }
    }

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