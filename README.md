# TeamRun Client

Teamruns is a client that enables you to play the OpenGOAL version of Jak & Daxter the precursor legacy in a semi multiplayer setting. Where powercells and certain tasks are shared between players (more to be implemented).

Teamruns requires a modded version of OpenGOAL to be ran to function that can be found here [ADD LINK], a quick setup guide for everything can also be found here [ADD LINK].

# Technology

The teamrun client is built as an Electron app using Angular for its frontend and NodeJS in the back, the multiplayer aspect functions using peer to peer communication between all clients through webRTC where shared events are communicated between all players in a run/lobby through one player acting as the host, each respective client then feeds the recived updates to their own instance of OpenGOAL. Signaling for the peer to peer communication is handled through firestore [ADD LINK] which also functions as the server to allow players to find open lobbies, a fallback using client-server communcation with firestore acting as the server is also implemented incase the STUN servers aren't enough to establish a peer to peer connection as no TURN server has been set up for this project so far.

## Setup

This setup if for running from VScode specifically, should probably work with anything else as well but it hasn't been tested.

Built on node version 19.6.1.

Clone down the repository.

Install "Desktop development with C++" from Visual Studio if not already installed.

Run `npm i` in both the root folder and the /app folder to install node modules for both front and backend.

In the /app folder run ´npm rebuild winax --runtime=electron --target=22.2.1 --dist-url=https://electronjs.org/headers --build-from-source´ otherwise winax will throw errors.

Open up the environment.ts file in /src/environments.

For work on Teamruns please contact me to be added to the firebase project linked to the published version where you'll find the config data.
For personal development setup a firebase project and add your personal firebase config data, and the user name and password of a created user with access to your firestore db.

Go back to the root folder and run `npm run start` to run in development mode, run `npm run dist` to build the production app or `npm run pack` to build an unpacked version.