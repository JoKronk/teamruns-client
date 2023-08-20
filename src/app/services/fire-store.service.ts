import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { environment } from 'src/environments/environment';
import { CollectionName } from '../common/firestore/collection-name';
import { DbRun } from '../common/firestore/db-run';
import { Lobby } from '../common/firestore/lobby';
import { Preset } from '../common/firestore/preset';
import { DataChannelEvent } from '../common/peer/data-channel-event';
import { RTCPeer } from '../common/peer/rtc-peer';
import { Run } from '../common/run/run';
import { DbUsersCollection } from '../common/firestore/db-users-collection';
import { CategoryOption } from '../common/run/category';
import { DbLeaderboard } from '../common/firestore/db-leaderboard';
import { DbPb } from '../common/firestore/db-pb';

@Injectable({
  providedIn: 'root'
})
export class FireStoreService {

  private personalBests: AngularFirestoreCollection<DbPb>;
  private leaderboards: AngularFirestoreCollection<DbLeaderboard>;
  private runs: AngularFirestoreCollection<Run>;
  private newStyleRuns: AngularFirestoreCollection<DbRun>;
  private globalData: AngularFirestoreCollection<DbUsersCollection>;
  private lobbies: AngularFirestoreCollection<Lobby>;
  private isAuthenticated: boolean = false;

  constructor(public firestore: AngularFirestore, public auth: AngularFireAuth) {

    this.personalBests = firestore.collection<DbPb>(CollectionName.personalBests);
    this.leaderboards = firestore.collection<DbLeaderboard>(CollectionName.leaderboards);
    this.runs = firestore.collection<Run>(CollectionName.runs);
    this.newStyleRuns = firestore.collection<DbRun>(CollectionName.newStyleRuns);
    this.globalData = firestore.collection<DbUsersCollection>(CollectionName.globalData);
    this.lobbies = firestore.collection<Lobby>(CollectionName.lobbies);
  }

  private checkAuthenticated() {
    if (this.isAuthenticated) return;
    this.auth.signInWithEmailAndPassword(environment.firestoreUsername, environment.firestorePassword).then(() => {
      this.isAuthenticated = true;
      return;
    });
  }

  getOpenLobbies() {
    this.checkAuthenticated();
    return this.firestore.collection<Lobby>(CollectionName.lobbies, ref => ref.where('visible', '==', true)).valueChanges();
  }

  getUserLobby(userId: string) {
    this.checkAuthenticated();
    return this.firestore.collection<Lobby>(CollectionName.lobbies, ref => ref.where('runners', 'array-contains', userId)).valueChanges();
  }

  getLobbyDoc(id: string) {
    this.checkAuthenticated();
    return this.firestore.collection<Lobby>(CollectionName.lobbies).doc(id);
  }

  async addLobby(lobby: Lobby) {
    this.checkAuthenticated();
    await this.lobbies.doc<Lobby>(lobby.id).set(JSON.parse(JSON.stringify(lobby)));
  }

  async updateLobby(lobby: Lobby) {
    this.checkAuthenticated();
    await this.addLobby(lobby); //they happen to be the same command, just trying to avoid confusion when looking for an update method
  }

  async deleteOldLobbies() {
    this.checkAuthenticated();
    const expireDate = new Date();
    expireDate.setHours(expireDate.getHours() - 4);

    (await this.lobbies.ref.get()).forEach(async (lobbySnapshot) => {
      let lobby = lobbySnapshot.data();
      if (new Date(lobby.creationDate) < expireDate) {
        await this.deleteLobby(lobbySnapshot.id);
      }
    });
  }

  async deleteLobby(id: string) {
    this.checkAuthenticated();
    await this.deleteLobbySubCollections(id);
    await this.lobbies.doc<Lobby>(id).delete();
  }

  async deleteLobbySubCollections(id: string) {
    this.checkAuthenticated();
    let lobbyConnections = this.lobbies.doc<Lobby>(id).collection(CollectionName.peerConnections);
    (await lobbyConnections.ref.get()).forEach(conSnapshot => {
      lobbyConnections.doc<RTCPeer>(conSnapshot.id).delete();
    });
    let lobbyCommunicationConnections = this.lobbies.doc<Lobby>(id).collection(CollectionName.serverEventCommuncation);
    (await lobbyCommunicationConnections.ref.get()).forEach(conSnapshot => {
      lobbyCommunicationConnections.doc<DataChannelEvent>(conSnapshot.id).delete();
    });
  }

  async deleteLobbyServerCommunication(lobbyId: string, id: string) {
    await this.lobbies.doc<Lobby>(lobbyId).collection(CollectionName.serverEventCommuncation).doc<DataChannelEvent>(id).delete();
  }

  async getUsers() {
    this.checkAuthenticated();
    return (await this.globalData.doc("users").ref.get()).data();
  }

  async updateUsers(userCollection: DbUsersCollection) {
    this.checkAuthenticated();
    await this.globalData.doc<DbUsersCollection>("users").set(JSON.parse(JSON.stringify(userCollection)));
  }

  async getRun(id: string) {
    this.checkAuthenticated();
    return (await this.runs.doc(id).ref.get()).data();
  }

  getLeaderboard(category: CategoryOption, sameLevel: boolean, players: number) {
    this.checkAuthenticated();
    return this.firestore.collection<DbLeaderboard>(CollectionName.leaderboards, ref => ref.where('category', '==', category).where('sameLevel', '==', sameLevel).where('players', '==', players)).valueChanges({idField: 'id'});
  }

  getLeaderboards(category: CategoryOption, sameLevel: boolean, playersCounts: number[]) {
    this.checkAuthenticated();
    return this.firestore.collection<DbLeaderboard>(CollectionName.leaderboards, ref => ref.where('category', '==', category).where('sameLevel', '==', sameLevel).where('players', 'in', playersCounts)).valueChanges({idField: 'id'});
  }

  getWrs(category: CategoryOption, sameLevel: boolean, playerCount: number) {
    this.checkAuthenticated();
    return this.firestore.collection<DbPb>(CollectionName.personalBests, ref => ref.where('category', '==', category).where('sameLevel', '==', sameLevel).where('playerCount', '==', playerCount).where('wasWr', '==', true)).valueChanges({idField: 'id'});
  }

  getRuns() {
    this.checkAuthenticated();
    return this.firestore.collection<Run>(CollectionName.runs, ref => ref.where('data.mode', '==', 0)).valueChanges({idField: 'runId'});
  }

  getUserRuns(userId: string) {
    this.checkAuthenticated();
    return this.firestore.collection<DbRun>(CollectionName.newStyleRuns, ref => ref.where('userIds.' + userId, '==', true)).valueChanges({idField: 'id'});
  }

  getNewStyleRuns() {
    this.checkAuthenticated();
    return this.firestore.collection<DbRun>(CollectionName.newStyleRuns, ref => ref.orderBy('date')).valueChanges({idField: 'id'});
  }

  async addRun(run: Run) {
    this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    await this.runs.doc<Run>().set(JSON.parse(JSON.stringify(run)));
  }

  async addNewStyleRun(run: DbRun) {
    this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    if (run.userIds instanceof Map)
      run.userIds = Object.fromEntries(run.userIds);
    
    const id = run.id;
    run.id = undefined;
    if (id)
      await this.newStyleRuns.doc<DbRun>(id).set(JSON.parse(JSON.stringify(run)));
    else
      await this.newStyleRuns.doc<DbRun>().set(JSON.parse(JSON.stringify(run)));
  }

  async addPb(run: DbPb) {
    this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    if (run.userIds instanceof Map)
      run.userIds = Object.fromEntries(run.userIds);
    
    const id = run.id;
    run.id = undefined;
    if (id)
      await this.personalBests.doc<DbPb>(id).set(JSON.parse(JSON.stringify(run)));
    else
      await this.personalBests.doc<DbPb>().set(JSON.parse(JSON.stringify(run)));
  }
  
  async putLeaderboard(leaderboard: DbLeaderboard) {
    this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    const id = leaderboard.id;
    leaderboard.id = undefined;
    console.log("Cat:" + leaderboard.category + " P:" + leaderboard.players + " S:" + leaderboard.sameLevel, leaderboard);
    if (id)
      await this.leaderboards.doc<DbLeaderboard>(id).set(JSON.parse(JSON.stringify(leaderboard)));
    else
      await this.leaderboards.doc<DbLeaderboard>().set(JSON.parse(JSON.stringify(leaderboard)));
  }

  async deleteRun(id: string) {
    this.checkAuthenticated();
    await this.runs.doc<Run>(id).delete();
  }

  async deleteNewStyleRun(id: string) {
    this.checkAuthenticated();
    await this.newStyleRuns.doc<DbRun>(id).delete();
  }

  async getPreset(id: string) {
    this.checkAuthenticated();
    return (await this.firestore.collection<Preset>(CollectionName.presets).doc<Preset>(id).ref.get()).data();
  }
}
