export class DownloadHandler {
    isDownloading: boolean;

    //Client update properties
    allowUpdate: boolean;
    updateIsReady: boolean;


		private updateCompleteListener: any;

    constructor() {
			this.setupListeners();
    }

		consentUpdate() {
			this.allowUpdate = true;
			this.installUpdate();
		}

    setupListeners() {
			//update ready
			this.updateCompleteListener = (window as any).electron.receive("update-downloaded", () => {
				this.updateCompleteListener();
				this.updateIsReady = true;
				this.installUpdate();
			});
    }

    resetProperties() {
			
    }
		
	installUpdate(): void {
		if (this.allowUpdate && this.updateIsReady) {
			(window as any).electron.send('update-start');
		}
	}

    onDestory() {
			if (this.updateCompleteListener) this.updateCompleteListener();
    }

}