import { TaskSplit } from "@app/common/opengoal/task-split";
import { invoke_rpc } from "./rpc";

export async function splitsFetch(): Promise<TaskSplit[] | null> {
  return await invoke_rpc("splits_fetch", {}, () => null);
}

export async function splitsWrite(): Promise<void> {
  return await invoke_rpc("splits_write", {}, () => {});
}