export class Taunts {
    index: number;
    name: string;
    input: string | undefined;
    valid: boolean;

    constructor(index: number) {
        this.index = index;
        this.name = Taunts.defaultTauntName(index);
        this.input = Taunts.tauntsInputSequence(index);
        this.valid = true;
    }

    public static defaultTauntName(index: number): string {
        switch (index) {
            case 0:
                return "BIL-TA09";
            case 1:
                return "BIL-AM1A";
            case 2:
                return "SKSP0095";
            case 3:
                return "FIS-AM04";
            case 4:
                return "SKSP0444";
            case 5:
                return "FAR-LO1A";
            case 6:
                return "RED-AM01";
            case 7:
                return "MSH-AM02";
            case 8:
                return "WAR-LO1B";
            case 9:
                return "CHI-AM01";
            case 10:
                return "SAGELP31";
            case 11:
                return "BLU-AM01";
            case 12:
                return "EXP-AM03";
            case 13:
                return "MTA-AM03";
            case 14:
                return "ASSTLP32";
            case 15:
                return "GEO-AM05";
            default:
                return "null";
        }
    }

    public static tauntsInputSequence(index: number): string | undefined {
        switch (index) {
            case 0:
                return "Up -> Up";
            case 1:
                return "Up -> Right";
            case 2:
                return "Up -> Down";
            case 3:
                return "Up -> Left";
            case 4:
                return "Right -> Up";
            case 5:
                return "Right -> Right";
            case 6:
                return "Right -> Down";
            case 7:
                return "Right -> Left";
            case 8:
                return "Down -> Up";
            case 9:
                return "Down -> Right";
            case 10:
                return "Down -> Down";
            case 11:
                return "Down -> Left";
            case 12:
                return "Left -> Up";
            case 13:
                return "Left -> Right";
            case 14:
                return "Left -> Down";
            case 15:
                return "Left -> Left";
            default:
                return undefined;
        }
    }

    static generateDefaultTauntList(): Taunts[] {
        let taunts: Taunts[] = [];
        for (let i = 0; i < 16; i++) {
            taunts.push(new Taunts(i));
        }
        return taunts;
    }

    static sanityCheck(name: string) {
        if (name.toUpperCase() === "ST-LOSE") {
            return true
        }
        if (name.length !== 8) {
            return false
        }
        let NPC3 = name.substring(0,3).toUpperCase();
        let NPC4 = name.substring(0,4).toUpperCase();
        let type = name.substring(4,6).toUpperCase();
        let index = name.substring(6);
        // NPC with 3 letter prefix
        switch(NPC3) {
            case "BIL": // boggy billy
            case "BIR": // bird lady
            case "BLU": // blue sage
            case "CHI": // mayor
            case "EXP": // uncle
            case "FAR": // farmer
            case "FIS": // fisherman
            case "GAM": // gambler
            case "GEO": // geologist
            case "GOL": // gol
            case "MAI": // maia
            case "MIN": // miners
            case "MSH": // gordy
            case "MTA": // willard
            case "RED": // red sage
            case "SCU": // sculptor
            case "WAR": // warrior
            case "YEL": // yellow sage
                if (name.charAt(3) === "-") {
                    // hint type
                    switch(type) {
                        case "AM":  // ambient
                        case "LO":  // loop
                        case "TA":  // task
                            // hint index
                            if (index.charAt(0) >= '0' && index.charAt(0) <= '3') {
                                return true
                            } else {
                                return false
                            }
                        default:
                            return false
                    }
                } else {
                    return false
                }
        }
        // NPC with 4 letter prefix
        switch(NPC4) {
            case "ASST":    // keira
            case "SAGE":    // samos
                // hint type
                switch(type) {
                    case "LP":  // loop
                    case "V1":  // communicator
                    case "VA":  // communicator
                    case "VB":  // communicator
                        // hint index
                        if (index >= '0' && index <= '76') {
                            return true
                        } else {
                            return false
                        }
                    default:
                        return false
                }
            case "SKSP":    // daxter
                switch(type) {
                    case "0B":
                        if (index === '42') {
                            return true
                        } else {
                            return false
                        }
                    default:
                        if (name.substring(4) >= '0000' && name.substring(4) <= '0466') {
                            return true
                        } else {
                            return false
                        }
                }
            default:
                return false
        }
    }
}