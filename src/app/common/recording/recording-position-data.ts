export class RecordingPositionData { //these names are shortened to reduce file size
    iT: number | undefined; //interType
    iA: number | undefined; //interAmount
    iS: number | undefined; //interStatus
    iN: string | undefined; //interName
    iP: string | undefined; //interParent
    iL: string | undefined; //interLevel
    iC: boolean | undefined; //interCleanup
    tX: number | undefined; //transX
    tY: number | undefined; //transY
    tZ: number | undefined; //transZ
    qX: number | undefined; //quatX
    qY: number | undefined; //quatY
    qZ: number | undefined; //quatZ
    qW: number | undefined; //quatW
    rY: number | undefined; //rotY
    tS: number | undefined; //tgtState
    cL: number | undefined; //currentLevel
    t: number; //time

    constructor () {

    }
}