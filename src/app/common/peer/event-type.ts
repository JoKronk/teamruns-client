export enum EventType {
    //master only calls
    Connect,
    RequestRunSync,
    RunSync,

    //peer distributed calls
    Disconnect,
    Reconnect,
    Kick,
    Ready,
    StartRun,
    NewCell,
    NewPlayerState,
    NewTaskStatusUpdate,
    ChangeTeam,
    ChangeTeamName,
    ToggleReset,
    EndPlayerRun
}