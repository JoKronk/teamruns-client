export class RecordingImport {
    
    name: string;
    size: string;
    path: string;

    constructor(file: any) {
        this.name = file.name.slice(0, -5);
        this.size = this.formatBytes(file.size);
        this.path = file.path;
    }

    private formatBytes(bytes: number, decimals: number = 2) {
      if (bytes === 0) {
        return '0 Bytes';
      }
      const k = 1024;
      const dm = decimals <= 0 ? 0 : decimals || 2;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}