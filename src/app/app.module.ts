import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import {MatSidenavModule} from '@angular/material/sidenav';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {MatDialogModule} from '@angular/material/dialog';

import { NavBoardComponent } from './nav-board/nav-board.component';
import { StartScreenComponent } from './start-screen/start-screen.component';
import { LobbyComponent } from './lobby/lobby.component';
import { SnackbarComponent } from './snackbar/snackbar.component';
import { CreateRunComponent } from './dialogs/create-run/create-run.component';
import { SetPathComponent } from './dialogs/set-path/set-path.component';
import { RunComponent } from './run/run.component';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireModule } from '@angular/fire/compat';
import { environment } from '../environments/environment';
import { RunTeamComponent } from './run-team/run-team.component';
import { RunTimerComponent } from './run-timer/run-timer.component';
import { RunSpectatorsComponent } from './run-spectators/run-spectators.component';
import { CloseScreenComponent } from './close-screen/close-screen.component';

@NgModule({
  declarations: [
    AppComponent,
    NavBoardComponent,
    StartScreenComponent,
    LobbyComponent,
    SnackbarComponent,
    CreateRunComponent,
    SetPathComponent,
    RunComponent,
    RunTeamComponent,
    RunTimerComponent,
    RunSpectatorsComponent,
    CloseScreenComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatSidenavModule,
    MatSnackBarModule,
    MatDialogModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
