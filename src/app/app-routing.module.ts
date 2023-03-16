import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CloseScreenComponent } from './close-screen/close-screen.component';
import { LobbyComponent } from './lobby/lobby.component';
import { ObsRunComponent } from './obs-run/obs-run.component';
import { RunComponent } from './run/run.component';
import { StartScreenComponent } from './start-screen/start-screen.component';

const routes: Routes = [
  { path: 'lobby', component: LobbyComponent },
  { path: 'run', component: RunComponent },
  { path: 'obs', component: ObsRunComponent },
  { path: 'close', component: CloseScreenComponent },
  { path: '', component: StartScreenComponent, pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
