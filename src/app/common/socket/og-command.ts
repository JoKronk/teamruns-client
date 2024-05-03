export enum OgCommand {
    None, //sends forced update with no command attached
    MarkConnected,
    SetupRun,
    StartRun,
    ResetGame,
    ResetActors,
    Trip,
    TargetGrab,
    TargetRelease,
    TempCheckpointStore,
    TempCheckpointLoad,
    EnableSpectatorMode,
    DisableSpectatorMode,
    OnRemoteLevelUpdate,
    EnableDebugMode,
    DisableDebugMode,
}