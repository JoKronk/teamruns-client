import { invoke, type InvokeArgs } from "@tauri-apps/api/core";
import { errorLog, exceptionLog } from "./logging";
import { InjectNotification } from "@app/utils/snackbar-injection";

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
    
    InjectNotification(notifOnError === "_mirror_" ? e : notifOnError);
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