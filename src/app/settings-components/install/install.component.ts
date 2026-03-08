import { Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { UserService } from '../../services/user.service';
import { DatePipe, Location } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '@app/services/api.service';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { GitRelease } from '@app/common/api/git-release';
import pkg from '@root/package.json';
import { ModInfo, SupportedGame } from '@app/common/api/mod-release';
import { GameType } from '@app/common/opengoal/game-type';
import { HeaderComponent } from '@app/window-components/header/header.component';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { DragDropDirective } from '@app/common/directives/drag-drop.directive';
import { HttpClientModule } from '@angular/common/http';
import { folderPrompt, isoPrompt } from 'src/app/utils/file-dialog';
import { downloadToolingVersion, listDownloadedVersions } from '@app/rpc/versions';
import { listGithubReleases } from '@app/utils/github';
import { configUpdateActiveVersion } from '@app/rpc/config';
import {MatTooltipModule} from '@angular/material/tooltip';

@Component({
    selector: 'app-install',
    templateUrl: './install.component.html',
  styleUrls: ['./install.component.scss'],
  imports: [HttpClientModule, FormsModule, RouterModule, HeaderComponent, DragDropDirective, DatePipe, MatTabsModule, MatTableModule, MatSlideToggleModule, MatRadioModule, MatTooltipModule],
  providers: [ApiService]
})
export class InstallComponent implements OnDestroy {

  clientReleaseSource: MatTableDataSource<GitRelease> = new MatTableDataSource();
  toolingReleaseSource: MatTableDataSource<GitRelease> = new MatTableDataSource();
  clientColumns: string[] = ["download", "version", "date", "changes"];
  toolingColumns: string[] = ["download", "version", "game", "date", "changes"];
  mods: ModInfo[] = [];

  games: GameType[] = GameType.getGames();

  storedVersionValue: string;
  isoInstallView: boolean = false;
  needsIsoInstall: boolean = false;
  pathVerificationStatus : number = 0;  //0 = unknown , 1 = valid , 2 = invalid
  tab: number = 0;
  gameTab: number = 0;
  
  clientVersion: string = "v" + pkg.version;

  private pathListener: any;
  
  constructor(public _user: UserService, private apiService: ApiService, private location: Location, private route: ActivatedRoute, private zone: NgZone) {
    this.getClientVersions();
    this.getGameVersions();
    this.getMods();
    
    this.route.queryParamMap.subscribe((params) => {
      
      const paramTab: number = Number(params.get('tab'));
      if (paramTab)0
        this.tab = paramTab;
      
      const paramGameTab: number = Number(params.get('gameTab'));
      if (paramGameTab)
        this.gameTab = paramGameTab;
    });
  }

  getClientVersions() {
    listGithubReleases("https://api.github.com/repos/JoKronk/teamruns-client/releases").then(data => {
      this.clientReleaseSource = new MatTableDataSource(data);
    });
  }

  getGameVersions() {
    listGithubReleases("https://api.github.com/repos/JoKronk/teamruns-jak-project/releases").then(data => {
      listDownloadedVersions().then((versions) => {
        data.forEach(release => {
          if (versions.includes(release.version))
            release.isDownloaded = true;
        });
        
        this.toolingReleaseSource = new MatTableDataSource(data);
      });
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

  downloadVersion(version: string, url: string) {
    downloadToolingVersion(version, url).then(downloaded => {
      if (!downloaded) return;
        
      let release = this.toolingReleaseSource.data.find(x => x.version === version);
      if (!release) {
        this._user.sendNotification("Downloaded tooling not found, please try again.");
        return;
      }
      
      release.isDownloaded = true;
      this._user.sendNotification("Tooling version installed!");
    });
  }

  updateToolingVersion(version: string) {
    configUpdateActiveVersion(version).then(success => {
      if (!success) return;

      this._user.launcherConfigs.activeVersion = version;
    });
  }

  unused_extractAndInstallIso(version: string, isoPath: string | undefined = undefined) {
    this.isoInstallView = true;
    if (this.needsIsoInstall && !this.isoInstallView) {
      this.storedVersionValue = version;
      return;
    }

    this._user.drawProgressBar();
  }

  checkForInstall() {
    (window as any).electron.send('install-check');
  }

  updateClient() {
    this._user.drawProgressBar();
    (window as any).electron.send('update-start');
  }

  unused() {
    this._user.sendNotification("I am yet to do anything");
  }

  async selectPath() {
    let path = await folderPrompt("Install Location");
    this.zone.run(() => {
      if (path) {
      this._user.launcherConfigs.installationDir = path;
      this.pathVerificationStatus = 0;
      this._user.writeUserDataChangesToLocal();
      }
    });
  }

  async selectIsoPath() {
    let path = await isoPrompt();
  }

  
  onFilesDrop(files: FileList) {
    const isoPath: string = (files.item(0) as any).path;

    if (!isoPath.endsWith(".iso")) {
      this._user.sendNotification("File is not of type ISO");
      return;
    }
  }

  ngOnDestroy(): void {
    if (this.pathListener) this.pathListener();
  }

}
