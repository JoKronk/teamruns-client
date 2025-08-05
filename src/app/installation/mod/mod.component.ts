import { Component } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute } from '@angular/router';
import { ModInfo, ModVersion, SupportedGame } from 'src/app/common/api/mod-release';
import { ApiService } from 'src/app/services/api.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-mod',
  templateUrl: './mod.component.html',
  styleUrls: ['./mod.component.scss']
})
export class ModComponent {
  
  gameReleaseSource: MatTableDataSource<ModVersion> = new MatTableDataSource();
  columns: string[] = ["download", "version", "date", "changes"];
  modId: string;
  gameId: SupportedGame;
  mod: ModInfo | undefined;

  constructor(public _user: UserService, private apiService: ApiService, private route: ActivatedRoute) {
    this.modId = this.route.snapshot.paramMap.get('id')!;
    this.gameId = this.route.snapshot.paramMap.get('game') as SupportedGame;
    this.getMods();
  }

  getMods() {
    const apiSubscription = this.apiService.getData("https://jakmods.dev/mods.json").subscribe(data => {
      apiSubscription.unsubscribe();
      
      for (let modId in data.mods) {
        if (modId === this.modId) {
          this.mod = data.mods[modId];
          if (this.mod?.versions) 
            this.gameReleaseSource = new MatTableDataSource(this.mod.versions.filter(x => !x.supportedGames || x.supportedGames.includes(this.gameId)).sort(function (a, b) {
            let dateA = Date.parse(a.publishedDate),
                dateB = Date.parse(b.publishedDate);
            return dateB - dateA;
          }));
          console.log(this.mod);
          break;
        }
      }
    });
  }

  getChangelogLink(version: ModVersion) {
    if (!version.assets) return;
    let tag = version.assets[Object.keys(version.assets)[0]]!;
    tag = tag.substring((tag.indexOf("releases/download/") + 18)).substring(0, tag.indexOf("/"));
    let url = version.assets[Object.keys(version.assets)[0]]!;
    url = url.substring(0, (url.indexOf("releases/download/") + 9));
    return url + "tag/" + tag;
  }

  installGameVersion(version: string, isoPath: string | undefined = undefined) {
      return;
    }

  getCoverArtUrl() {
    if (!this.mod)
      return;
    return this.mod.perGameConfig ? this.mod.perGameConfig[this.gameId]?.coverArtUrl ?? this.mod.coverArtUrl : this.mod.coverArtUrl;
  }

}
