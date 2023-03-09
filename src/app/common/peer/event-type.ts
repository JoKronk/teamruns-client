export enum EventType {
    Connect,
    Disconnect,
    RequestRunSync,
    RunSync,

    Ready,
    StartRun,
    NewCell,
    NewPlayerState,
    NewTaskStatusUpdate,
    ChangeTeam,
    ToggleReset,
    EndPlayerRun,
    CheckRemoveRunner
}