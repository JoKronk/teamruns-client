export class NotificationPackage {
    message: string;
    time: number;

    constructor (message: string, timeSeconds: number = 10) {
        this.message = message;
        this.time = timeSeconds;
    }
}