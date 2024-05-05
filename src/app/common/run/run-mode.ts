export enum RunMode {
    Speedrun,
    Lockout,
    Casual
}

//Add mod/mode settings here
export class RunMod {

    public static singleTeamEqualsFFA(mode: RunMode) {
        switch (mode) {
            case RunMode.Lockout:
                return true;
            default:
                return false;
        }
    }

    public static endRunOnSigleTeamFinish(mode: RunMode) {
        switch (mode) {
            case RunMode.Lockout:
                return true;
            default:
                return false;
        }
    }

    public static usesMidGameRestartPenaltyLogic(mode: RunMode) {
        switch (mode) {
            case RunMode.Casual:
                return false;
            default:
                return true;
        }
    }

    public static isAddedToRunHistory(mode: RunMode) {
        switch (mode) {
            case RunMode.Speedrun:
            case RunMode.Lockout:
                return true;
            default:
                return false;
        }
    }
}