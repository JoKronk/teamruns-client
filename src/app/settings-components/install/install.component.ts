import { Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from 'src/app/services/api.service';
import { MatTableDataSource } from '@angular/material/table';
import { GitRelease } from 'src/app/common/api/git-release';
import pkg from 'app/package.json';
import { ModInfo, SupportedGame } from 'src/app/common/api/mod-release';
import { GameType } from 'src/app/common/opengoal/game-type';

@Component({
  selector: 'app-install',
  templateUrl: './install.component.html',
  styleUrls: ['./install.component.scss']
})
export class InstallComponent implements OnDestroy {

  clientReleaseSource: MatTableDataSource<GitRelease> = new MatTableDataSource();
  gameReleaseSource: MatTableDataSource<GitRelease> = new MatTableDataSource();
  columns: string[] = ["download", "version", "date", "changes"];
  mods: ModInfo[] = [];

  games: GameType[] = GameType.getGames();

  storedVersionValue: string;
  isoInstallView: boolean = false;
  needsIsoInstall: boolean = false;
  pathVerificationStatus : number = 0;  //0 = unknown , 1 = valid , 2 = invalid
  tab: number = 0;
  gameTab: number = 0;
  

  selectingForIso: boolean;
  clientVersion: string = "v" + pkg.version;

  private pathListener: any;
  
  constructor(public _user: UserService, private apiService: ApiService, private location: Location, private route: ActivatedRoute, private zone: NgZone) {
    this.setupPathListener();
    
    this.getClientVersions();
    this.getGameVersions();
    this.getMods();
    
    this.route.queryParamMap.subscribe((params) => {
      
      const paramTab: number = Number(params.get('tab'));
      if (paramTab)
        this.tab = paramTab;
      
      const paramGameTab: number = Number(params.get('gameTab'));
      if (paramGameTab)
        this.gameTab = paramGameTab;
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
          this._user.writeUserDataChangesToLocal();
        }
      });
    });
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

  getMods() {
    const apiSubscription = this.apiService.getData("https://jakmods.dev/mods.json").subscribe(data => {
      apiSubscription.unsubscribe();
      for (let modId in data.mods) {
        let mod: ModInfo = data.mods[modId];
        mod.id = modId;
        this.mods.push(mod);
      }
      this.mods.sort((a, b) => {
        return a.displayName.localeCompare(b.displayName);
      });
    });
  }
  
  getThumbnailArtUrl(mod: ModInfo, gameId: SupportedGame) {
    return mod.perGameConfig ? mod.perGameConfig[gameId]?.thumbnailArtUrl ?? mod.thumbnailArtUrl : mod.thumbnailArtUrl;
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
  }

  checkForInstall() {
    (window as any).electron.send('install-check');
  }

  updateClient() {
    this._user.drawProgressBar();
    (window as any).electron.send('update-start');
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

  ngOnDestroy(): void {
    if (this.pathListener) this.pathListener();
  }

}
