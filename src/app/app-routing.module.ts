import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CloseScreenComponent } from './close-screen/close-screen.component';
import { LobbyComponent } from './lobby/lobby.component';
import { RunComponent } from './run-components/run/run.component';
import { StartScreenComponent } from './start-screen/start-screen.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { RunHistoryComponent } from './run-history/run-history.component';
import { PracticeComponent } from './run-components/practice/practice.component';
import { UserSettingsComponent } from './settings-components/user-settings/user-settings.component';
import { InstallComponent } from './settings-components/install/install.component';

const routes: Routes = [
  { path: 'lobby', component: LobbyComponent },
  { path: 'run', component: RunComponent },
  { path: 'leaderboard', component: LeaderboardComponent },
  { path: 'history', component: RunHistoryComponent },
  { path: 'practice', component: PracticeComponent },
  { path: 'settings', component: UserSettingsComponent },
  { path: 'install', component: InstallComponent },
  { path: 'close', component: CloseScreenComponent },
  { path: '', component: StartScreenComponent, pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
