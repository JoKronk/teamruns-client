export enum RunMode {
    Speedrun,
    Lockout,
    Casual
}

//Add mod/mode settings here
export class RunMod {

    public static singleTeamEqualsFFA(mode: RunMode): boolean {
        switch (mode) {
            case RunMode.Lockout:
                return true;
            default:
                return false;
        }
    }

    public static endRunOnSiglePlayerFinish(mode: RunMode): boolean {
        switch (mode) {
            case RunMode.Lockout:
                return true;
            default:
                return false;
        }
    }

    public static usesMidGameRestartPenaltyLogic(mode: RunMode): boolean {
        switch (mode) {
            case RunMode.Casual:
                return false;
            default:
                return true;
        }
    }

    public static isAddedToRunHistory(mode: RunMode): boolean {
        switch (mode) {
            case RunMode.Speedrun:
            case RunMode.Lockout:
                return true;
            default:
                return false;
        }
    }

    public static getInfo(mode: RunMode): string | null {
        switch (mode) {
            case RunMode.Lockout:
                return "Pickups are shared but only given to the collecting team, unlocks tied to them are shared to all. Final boss unlocks after 73 total cells, only the team(s) with the highest cell score at any point after that will have access to final boss.";
            default:
                return null;
        }
    }
}