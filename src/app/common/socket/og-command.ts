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
    FreeCamEnter,
    FreeCamExit,
    OnRemoteLevelUpdate,
    EnableDebugMode,
    DisableDebugMode,
    EnableSpectatorMode,
    DisableSpectatorMode
}