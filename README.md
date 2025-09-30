# TeamRun Client

Teamruns is a client that enables you to play the OpenGOAL version of Jak & Daxter in a multiplayer setting.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) + [Angular Language Service](https://marketplace.visualstudio.com/items?itemName=Angular.ng-template).


# Technology

The teamrun client is built using Tauri combined with Angular, the multiplayer aspect functions using peer to peer communication between all clients through webRTC where shared events are communicated between all players in a run/lobby through one player acting as the host. Each respective client recives and feeds updates to their own instance of OpenGOAL using a websocket. Signaling for the peer to peer communication is handled through firestore which also functions as a database for things like lobbies and history data.

## Setup

`pnpm install`

Set up values for features you want to take use of in the environment.ts file in /src/environments.

For work on the official Teamruns version please contact me to be added to the firebase project linked to the published version where you'll find the config data.

`pnpm tauri dev`