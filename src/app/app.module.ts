import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgChartsModule } from 'ng2-charts';

import {MatSidenavModule} from '@angular/material/sidenav';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {MatDialogModule} from '@angular/material/dialog';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTableModule} from '@angular/material/table';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatSliderModule} from '@angular/material/slider';
import {MatMenuModule} from '@angular/material/menu';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatProgressBarModule} from '@angular/material/progress-bar';

import { NavBoardComponent } from './nav-board/nav-board.component';
import { StartScreenComponent } from './start-screen/start-screen.component';
import { LobbyComponent } from './lobby/lobby.component';
import { SnackbarComponent } from './snackbar/snackbar.component';
import { CreateRunComponent } from './dialogs/create-run/create-run.component';
import { RunComponent } from './run/run.component';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { environment } from '../environments/environment';
import { RunSplitsComponent } from './run-splits/run-splits.component';
import { RunTimerComponent } from './run-timer/run-timer.component';
import { RunSpectatorsComponent } from './run-spectators/run-spectators.component';
import { CloseScreenComponent } from './close-screen/close-screen.component';
import { LobbyViewerComponent } from './lobby-viewer/lobby-viewer.component';
import { ConfirmComponent } from './dialogs/confirm/confirm.component';
import { InfoComponent } from './dialogs/info/info.component';
import { InputDialogComponent } from './dialogs/input-dialog/input-dialog.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { HeaderComponent } from './header/header.component';
import { RunHistoryComponent } from './run-history/run-history.component';
import { PracticeComponent } from './practice/practice.component';
import { DragDropDirective } from './common/directives/drag-drop.directive';
import { AccountDialogComponent } from './dialogs/account-dialog/account-dialog.component';
import { UserSettingsComponent } from './user-settings/user-settings.component';
import { AutoFocusDirective } from './common/directives/auto-focus.directive';
import { AddPlayerComponent } from './dialogs/add-player/add-player.component';
import { SetControllerComponent } from './dialogs/set-controller/set-controller.component';
import { PbCommentDialogComponent } from './dialogs/pb-comment-dialog/pb-comment-dialog.component';
import { InstallComponent } from './install/install.component';
import { SnackbarInstallComponent } from './snackbar-install/snackbar-install.component';

@NgModule({
  declarations: [
    AppComponent,
    NavBoardComponent,
    StartScreenComponent,
    LobbyComponent,
    SnackbarComponent,
    CreateRunComponent,
    RunComponent,
    RunSplitsComponent,
    RunTimerComponent,
    RunSpectatorsComponent,
    CloseScreenComponent,
    LobbyViewerComponent,
    ConfirmComponent,
    InfoComponent,
    InputDialogComponent,
    LeaderboardComponent,
    HeaderComponent,
    RunHistoryComponent,
    PracticeComponent,
    DragDropDirective,
    AccountDialogComponent,
    UserSettingsComponent,
    AutoFocusDirective,
    AddPlayerComponent,
    SetControllerComponent,
    PbCommentDialogComponent,
    InstallComponent,
    SnackbarInstallComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    NgChartsModule,
    MatSidenavModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatButtonToggleModule,
    MatSliderModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
