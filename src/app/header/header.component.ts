import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';
import pkg from 'app/package.json';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmComponent } from '../dialogs/confirm/confirm.component';
import { CreateRunComponent } from '../dialogs/create-run/create-run.component';
import { InfoComponent } from '../dialogs/info/info.component';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  
  buildVersion: string = pkg.version;
  @Input() runInfo?: string;
  @Input() inRun: boolean;
  @Input() showLobbyButtons: boolean;
  
  constructor(public _user: UserService, private router: Router, private dialog: MatDialog) {
    
  }
  

  createLobby(): void {
    this.dialog.open(CreateRunComponent);
  }

  openInfo() {
    this.dialog.open(InfoComponent, {maxWidth: "100vw"});
  }
  

  routeToLobby() {
    if (!this.inRun) {
      this.router.navigate(['/lobby' ]);
      return;
    }

    const dialogRef = this.dialog.open(ConfirmComponent, { data: "Are you sure you want to leave the game?" });
    const dialogSubscription = dialogRef.afterClosed().subscribe(confirmed => {
      dialogSubscription.unsubscribe();
      if (confirmed)
        this.router.navigate(['/lobby' ]);
    });
  }

}
