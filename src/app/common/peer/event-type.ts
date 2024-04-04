export enum EventType {
    //master only calls
    RequestRunSync,
    RunSync,

    //peer distributed calls
    Connect,
    Disconnect,
    Reconnect,
    GameClosed,
    Kick,
    PositionChannelOpen,
    PositionChannelClosed,
    Ready,
    StartRun,
    NewPlayerState,
    ChangeTeam,
    ChangeTeamName,
    ToggleReset,
    EndPlayerRun,
    NewPb,
    ImportRecordings
}