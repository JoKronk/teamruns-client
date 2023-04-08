export enum EventType {
    //master only calls
    RequestRunSync,
    RunSync,

    //peer distributed calls
    Connect,
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