export enum EventType {
    //master only calls
    RequestRunSync,
    RunSync,

    //peer distributed calls
    Connect,
    Disconnect,
    Reconnect,
    Kick,
    PositionChannelOpen,
    PositionChannelClosed,
    Ready,
    StartRun,
    NewTaskUpdate,
    NewPlayerState,
    ChangeTeam,
    ChangeTeamName,
    ToggleReset,
    EndPlayerRun
}