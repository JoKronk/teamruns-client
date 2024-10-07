import { Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from 'src/app/services/api.service';
import { MatTableDataSource } from '@angular/material/table';
import { GitRelease } from 'src/app/common/api/git-release';
import pkg from 'app/package.json';

@Component({
  selector: 'app-install',
  templateUrl: './install.component.html',
  styleUrls: ['./install.component.scss']
})
export class InstallComponent implements OnDestroy {
  
  @ViewChild('video') video: ElementRef;
  @ViewChild('blackscreen') blackscreen: ElementRef;

  
  clientReleaseSource: MatTableDataSource<GitRelease> = new MatTableDataSource();
  gameReleaseSource: MatTableDataSource<GitRelease> = new MatTableDataSource();
  columns: string[] = ["download", "version", "date", "changes"];

  storedVersionValue: string;
  isoInstallView: boolean = false;
  needsIsoInstall: boolean = false;
  pathVerificationStatus : number = 0;  //0 = unknown , 1 = valid , 2 = invalid
  tabForceSet: boolean = false;
  tab: number = 0;

  selectingForIso: boolean;
  clientVersion: string = "v" + pkg.version;

  private pathListener: any;
  private installMissingListener: any;
  private installFoundListener: any;
  private installOutdatedListener: any;
  
  constructor(public _user: UserService, private apiService: ApiService, private location: Location, private route: ActivatedRoute, private zone: NgZone) {
    this.checkVideoLoad();

    this.setupPathListener();
    
    this.getClientVersions();
    this.getGameVersions();
    
    this.route.queryParamMap.subscribe((params) => {
      
      if (params.get('client') === "1")
        this.tabForceSet = true; //tab default 0 so no need to set
      else if (params.get('install') === "1")
        this.moveToGameVersionTab(true);
      else if (params.get('update') === "1")
        this.moveToGameVersionTab(false);
      
      if (!this.tabForceSet) {
        this.setupInstallListeners();
        this.checkForInstall();
      }
    });

    setTimeout(() => {
      this.blackscreen.nativeElement.classList.add('blackscreen-fade');
    }, 200);
  }

  moveToGameVersionTab(needsInstall: boolean) {
    if (needsInstall)
      this.needsIsoInstall = needsInstall;
    this.tabForceSet = true;
    this.tab = 1;
  }

  setupInstallListeners() {
    this.installMissingListener = (window as any).electron.receive("install-missing", () => {
      this.zone.run(() => {
        this.pathVerificationStatus = 2;
        this.moveToGameVersionTab(true);
      });
    });

    this.installFoundListener = (window as any).electron.receive("install-found", () => {
      this.zone.run(() => {
        this.needsIsoInstall = false;
        this.pathVerificationStatus = 1;
      });
    });
  }

  setupPathListener() {
    this.pathListener = (window as any).electron.receive("settings-get-path", (path: string) => {
      this.zone.run(() => {

        if (this.selectingForIso) 
          this.installGameVersion(this.storedVersionValue, path);
        else {
          this._user.user.ogFolderpath = path;
          this.pathVerificationStatus = 0;
          this.writeSettings();
        }
      });
    });
  }

  writeSettings() {
    this._user.writeUserDataChangesToLocal();
  }

  getClientVersions() {
    const apiSubscription = this.apiService.getData("https://api.github.com/repos/JoKronk/teamruns-client/releases").subscribe(data => {
      apiSubscription.unsubscribe();
      this.clientReleaseSource = new MatTableDataSource(data);
    });
  }

  getGameVersions() {
    const apiSubscription = this.apiService.getData("https://api.github.com/repos/JoKronk/teamruns-jak-project/releases").subscribe(data => {
      apiSubscription.unsubscribe();
      this.gameReleaseSource = new MatTableDataSource(data);
    });
  }

  installClient(version: string) {
    this._user.drawProgressBar();
    (window as any).electron.send('download-portable', version.substring(1));
  }

  installGameVersion(version: string, isoPath: string | undefined = undefined) {
    if (this.needsIsoInstall && !this.isoInstallView) {
      this.isoInstallView = true;
      this.storedVersionValue = version;
      return;
    }
    
    this._user.drawProgressBar();
    (window as any).electron.send('install-start', {url: "https://github.com/JoKronk/teamruns-jak-project", isoPath: isoPath, version: version});
    this.routeBack();
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
    this.installGameVersion(this.storedVersionValue, isoPath);
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
