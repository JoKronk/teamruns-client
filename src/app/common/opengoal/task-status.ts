export class TaskStatus {

    public static invalid = "invalid";
    public static unknown = "unknown";
    public static needHint = "need-hint";
    public static needIntroduction = "need-introduction";
    public static needReminderA = "need-reminder-a";
    public static needReminder = "need-reminder";
    public static needRewardSpeech = "need-reward-speech";
    public static needResolution = "need-resolution";

    public static getEnumValues(): Map<string, number> {
        return new Map([
            [this.invalid, 0],
            [this.unknown, 1],
            [this.needHint, 2],
            [this.needIntroduction, 3],
            [this.needReminderA, 4],
            [this.needReminder, 5],
            [this.needRewardSpeech, 6],
            [this.needResolution, 7]
        ]);
    }
    
    public static getEnumValue(status: string): number | undefined {
        return this.getEnumValues().get(status);
    }
}