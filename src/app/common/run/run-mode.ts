export enum RunMode {
    Speedrun,
    Lockout,
    Casual
}

//Add mod/mode settings here
export class RunMod {

    public static singleTeamEqualsFFA(mode: RunMode) {
        return ([
            RunMode.Lockout
        ]).includes(mode);
    }

    public static endRunOnSigleTeamFinish(mode: RunMode) {
        return ([
            RunMode.Lockout
        ]).includes(mode);
    }
}