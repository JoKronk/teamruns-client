import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CloseScreenComponent } from './close-screen/close-screen.component';
import { LobbyComponent } from './lobby/lobby.component';
import { RunComponent } from './run/run.component';
import { StartScreenComponent } from './start-screen/start-screen.component';
import { RunHistoryComponent } from './run-history/run-history.component';

const routes: Routes = [
  { path: 'lobby', component: LobbyComponent },
  { path: 'run', component: RunComponent },
  { path: 'history', component: RunHistoryComponent },
  { path: 'close', component: CloseScreenComponent },
  { path: '', component: StartScreenComponent, pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
