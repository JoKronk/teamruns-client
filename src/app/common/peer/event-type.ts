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
    NewScoutflyCollected,
    NewOrbCollected,
    NewCrateDestoryed,
    ChangeTeam,
    ChangeTeamName,
    ToggleReset,
    EndPlayerRun
}