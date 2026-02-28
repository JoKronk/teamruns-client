import { invoke, type InvokeArgs } from "@tauri-apps/api/core";
import { errorLog, exceptionLog } from "./logging";
import { inject } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SnackbarComponent } from "@app/snackbars/snackbar/snackbar.component";

/**
 * @param cmd The command to send to the backend
 * @param args The arguments for the command
 * @param handleError If an error occurs, this is called with the error before returning
 * @param onSuccess If the call succeeds, this is called with the result before returning
 */
export async function invoke_rpc<T>(cmd: string, args: InvokeArgs, handleError: (error: unknown) => T, notifOnError?: string, onSuccess?: (result: T) => T): Promise<T> {
  try {
    // this assumes the call is made in a way that does not trick the type inference
    const result: T = await invoke(cmd, args);
    if (onSuccess) {
      return onSuccess(result);
    }
    return result;
  } catch (e: any) {
    if (typeof e === "string")
      errorLog(`Error calling '${cmd}': ${e}`);
    else
      exceptionLog(`Error calling '${cmd}'`, e);
    
    // TODO - this is a dumb hack but whatever for now
    const snackbar = inject(MatSnackBar);
    snackbar.openFromComponent(SnackbarComponent, {
      duration: 5000,
      data: notifOnError === "_mirror_" ? e : notifOnError,
      verticalPosition: 'bottom',
      horizontalPosition: 'right'
    });
    return handleError(e);
  }
}

/*
  greet(event: SubmitEvent, name: string): void {
    event.preventDefault();

    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    invoke<string>("greet", { name }).then((text) => {
      console.log(text);
    });
  }
    */