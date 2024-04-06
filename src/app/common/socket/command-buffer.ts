import { OgCommand } from "./og-command";

export class CommandBuffer {
    userId: string;
    commandBuffer: OgCommand[];

    constructor (userId: string, buffer: OgCommand[]) {
        this.userId = userId;
        this.commandBuffer = buffer;
    }
}