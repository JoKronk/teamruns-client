import { Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-install',
  templateUrl: './install.component.html',
  styleUrls: ['./install.component.scss']
})
export class InstallComponent implements OnDestroy {
  
  @ViewChild('video') video: ElementRef;
  @ViewChild('blackscreen') blackscreen: ElementRef;

  clientUpdate: boolean = false;
  install: boolean = false;
  update: boolean = false;

  selectingForIso: boolean;

  private pathListener: any;
  private installMissingListener: any;
  private installFoundListener: any;
  private installOutdatedListener: any;
  
  constructor(public _user: UserService, private location: Location, private route: ActivatedRoute, private zone: NgZone) {
    this.checkVideoLoad();

    this.setupInstallListeners();
    this.setupPathListener();
    
    this.route.queryParamMap.subscribe((params) => {
      this.clientUpdate = params.get('client') === "1";
      this.install = params.get('install') === "1";
      this.update = params.get('update') === "1";
      
      if (!this.clientUpdate && !this.install && !this.update)
        this.checkForInstall();
    });
  }

  setupInstallListeners() {
    this.installMissingListener = (window as any).electron.receive("install-missing", () => {
      this.zone.run(() => {
        if (!this.clientUpdate)
          this.install = true;
      });
    });

    this.installFoundListener = (window as any).electron.receive("install-found", () => {
      this.zone.run(() => {
        this.install = false;
      });
    });

    this.installOutdatedListener = (window as any).electron.receive("install-outdated", () => {
      this.zone.run(() => {
        this.update = true;
      });
    });
  }

  setupPathListener() {
    this.pathListener = (window as any).electron.receive("settings-get-path", (path: string) => {
      this.zone.run(() => {

        if (this.selectingForIso) 
          this.installGame(path);
        else {
          this._user.user.ogFolderpath = path;
          this._user.writeUserDataChangesToLocal();
        }
      });
    });
  }

  checkForInstall() {
    (window as any).electron.send('install-check');
  }

  routeBack() {
    this.blackscreen.nativeElement.classList.remove('blackscreen-fade');
    setTimeout(() => {
      this.location.back();
    }, 150);
  }

  updateClient() {
    this._user.drawProgressBar();
    (window as any).electron.send('update-start');
    this.routeBack();
  }

  updateGame() {
    this._user.drawProgressBar();
    (window as any).electron.send('install-update');
    this.routeBack();
  }

  installGame(isoPath: string) {
    this._user.drawProgressBar();
    (window as any).electron.send('install-start', isoPath);
    this.routeBack();
  }

  selectPath(forIso: boolean = true) {
    this.selectingForIso = forIso;
    (window as any).electron.send('settings-select-path', forIso);
  }

  
  onFilesDrop(files: FileList) {
    const isoPath: string = (files.item(0) as any).path;

    if (!isoPath.endsWith(".iso")) {
      this._user.sendNotification("File is not of type ISO");
      return;
    }
    this.installGame(isoPath);
  }

  checkVideoLoad() {
    setTimeout(() => {
      if (this.video.nativeElement.readyState === 4) {
        this.blackscreen.nativeElement.classList.add('blackscreen-fade');
        (window as any).electron.send('install-check');

        return;
      }
      else 
        this.checkVideoLoad();
    }, 200);
  }

  ngOnDestroy(): void {
    if (this.pathListener) this.pathListener();
    if (this.installMissingListener) this.installMissingListener();
    if (this.installFoundListener) this.installMissingListener();
    if (this.installOutdatedListener) this.installOutdatedListener();
  }

}
