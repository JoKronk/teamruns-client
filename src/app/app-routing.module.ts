import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LobbyComponent } from './lobby/lobby.component';
import { RunComponent } from './run/run.component';
import { StartScreenComponent } from './start-screen/start-screen.component';

const routes: Routes = [
  { path: 'lobby', component: LobbyComponent },
  { path: 'run', component: RunComponent },
  { path: '', component: StartScreenComponent, pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
