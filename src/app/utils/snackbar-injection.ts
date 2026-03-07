import { inject } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SnackbarComponent } from "@app/snackbars/snackbar/snackbar.component";

// TODO - feels like a kinda dumb way to do this but it'll do for now
export function InjectNotification(notifMsg: string, duration: number | undefined = undefined) {
    inject(MatSnackBar).openFromComponent(SnackbarComponent, {
      duration: duration ?? 5000,
      data: notifMsg,
      verticalPosition: 'bottom',
      horizontalPosition: 'right'
    });
}