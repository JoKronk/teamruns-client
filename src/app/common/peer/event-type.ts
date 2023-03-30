export enum EventType {
    //master only calls
    Connect,
    RequestRunSync,
    RunSync,

    //peer distributed calls
    Disconnect,
    Kick,
    Ready,
    StartRun,
    NewCell,
    NewPlayerState,
    NewTaskStatusUpdate,
    ChangeTeam,
    ToggleReset,
    EndPlayerRun
}