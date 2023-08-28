import { OG } from "../opengoal/og";
import { PositionDataTimestamp, UserPositionDataTimestamp } from "./position-data";
import { DbUserPositionData } from "./db-user-position-data";

export class PositionHandler {

    userPositionData: DbUserPositionData[];
    private userIdMapping: string[];

    constructor() {
        this.userPositionData = [];
    }

    updatePosition(positionData: UserPositionDataTimestamp) {
        let userPos = this.userPositionData.find(x => x.userId === positionData.userId);
        if (!userPos) {
            userPos = new DbUserPositionData(positionData.userId);
            this.userIdMapping.push(positionData.userId);
            this.userPositionData.push(userPos);
        }
        
        OG.updatePlayerPosition(positionData, (this.userIdMapping.indexOf(positionData.userId) + 1));

        if (positionData.time !== 0)
            userPos.playback.push(new PositionDataTimestamp(positionData, positionData.time));
    }
}