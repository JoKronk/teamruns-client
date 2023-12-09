export class RecordingImport {
    
    name: string;
    path: string;

    constructor(file: any) {
        this.name = file.name.slice(0, -5);
        this.path = file.path;
    }
}