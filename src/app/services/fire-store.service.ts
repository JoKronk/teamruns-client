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
import { DbUsersCollection } from '../common/firestore/db-users-collection';
import { CategoryOption } from '../common/run/category';
import { DbLeaderboard } from '../common/firestore/db-leaderboard';
import { DbPb } from '../common/firestore/db-pb';
import { DbUserProfile } from '../common/firestore/db-user-profile';
import { AccountReply } from '../dialogs/account-dialog/account-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class FireStoreService {

  private personalBests: AngularFirestoreCollection<DbPb>;
  private leaderboards: AngularFirestoreCollection<DbLeaderboard>;
  private runs: AngularFirestoreCollection<DbRun>;
  private globalData: AngularFirestoreCollection<DbUsersCollection>;
  private lobbies: AngularFirestoreCollection<Lobby>;

  private isAuthenticated: boolean = false;
  private currentUser: firebase.default.User | null = null;

  constructor(public firestore: AngularFirestore, public auth: AngularFireAuth) {

    this.personalBests = firestore.collection<DbPb>(CollectionName.personalBests);
    this.leaderboards = firestore.collection<DbLeaderboard>(CollectionName.leaderboards);
    this.runs = firestore.collection<DbRun>(CollectionName.runs);
    this.globalData = firestore.collection<DbUsersCollection>(CollectionName.globalData);
    this.lobbies = firestore.collection<Lobby>(CollectionName.lobbies);
  }

  async deleteCurrentUser(): Promise<boolean> {
    if (this.currentUser) {
      await this.currentUser.delete();
      this.isAuthenticated = false;
      await this.checkAuthenticated();
      return true;
    }
    return false;
  }

  createUser(username: string, pw: string, setAsCurrent: boolean = true): Promise<AccountReply> { //firebase forces it to be an email to doesn't require it to exist..
    this.checkAuthenticated();
    return this.auth.createUserWithEmailAndPassword(username + "@teamrun.web.app", pw).then((userCredential) => {
      this.isAuthenticated = true;

      if (setAsCurrent)
        this.currentUser = userCredential.user;

      return new AccountReply(true);
    }).catch((error: firebase.default.FirebaseError) => {
      return new AccountReply(false, error.message);
    });
  }

  authenticateUsernamePw(user: DbUserProfile, pw: string) {
    return this.auth.signInWithEmailAndPassword(user.name + "@teamrun.web.app", pw).then((userCredential) => {
      this.isAuthenticated = true;
      this.currentUser = userCredential.user;
      return true;
    }).catch(error => {
      return false;
    });
  }

  private async checkAuthenticated() { // !TODO: this currently has some problems in some case as not all firestore functions created here are async atm, but the user is usually already signed in in all use cases where it's not async..
    if (this.isAuthenticated) return;
    return await this.auth.signInWithEmailAndPassword(environment.firestoreUsername, environment.firestorePassword).then(() => {
      this.isAuthenticated = true;
      return;
    });
  }

  // ----- GET -----

  getOpenLobbies() {
    this.checkAuthenticated();
    return this.firestore.collection<Lobby>(CollectionName.lobbies, ref => ref.where('visible', '==', true)).valueChanges();
  }
  getLobbyDoc(id: string) {
    this.checkAuthenticated();
    return this.lobbies.doc(id);
  }

  getUserLobby(userId: string) {
    this.checkAuthenticated();
    return this.firestore.collection<Lobby>(CollectionName.lobbies, ref => ref.where('runners', 'array-contains', userId)).valueChanges();
  }

  async getUsers() { // NOTE: why only all? All users are stored in one array currently to reduce read cost when getting users for leaderboards and such, TLDR: Cost savings (but a bit scuffed)
    await this.checkAuthenticated();
    return (await this.globalData.doc("users").ref.get()).data();
  }

  async getRun(id: string) {
    await this.checkAuthenticated();
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
    return this.runs.valueChanges({idField: 'id'});
  }

  getUserRuns(userId: string) {
    this.checkAuthenticated();
    return this.firestore.collection<DbRun>(CollectionName.runs, ref => ref.where('userIds.' + userId, '==', true)).valueChanges({idField: 'id'});
  }

  async getPreset(id: string) {
    await this.checkAuthenticated();
    return (await this.firestore.collection<Preset>(CollectionName.presets).doc<Preset>(id).ref.get()).data();
  }

  // ----- POST/PUT -----

  async addLobby(lobby: Lobby) {
    await this.checkAuthenticated();
    await this.lobbies.doc<Lobby>(lobby.id).set(JSON.parse(JSON.stringify(lobby)));
  }

  async updateLobby(lobby: Lobby) {
    await this.checkAuthenticated();
    await this.addLobby(lobby); //they happen to be the same command, just trying to avoid confusion when looking for an update method
  }

  async addRun(run: DbRun) {
    await this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    if (run.userIds instanceof Map)
      run.userIds = Object.fromEntries(run.userIds);
    
    const id = run.id;
    run.id = undefined;
    if (id)
      await this.runs.doc<DbRun>(id).set(JSON.parse(JSON.stringify(run)));
    else
      await this.runs.doc<DbRun>().set(JSON.parse(JSON.stringify(run)));
  }

  async addPb(run: DbPb) {
    await this.checkAuthenticated();
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
    await this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    const id = leaderboard.id;
    leaderboard.id = undefined;
    console.log("Cat:" + leaderboard.category + " P:" + leaderboard.players + " S:" + leaderboard.sameLevel, leaderboard);
    if (id)
      await this.leaderboards.doc<DbLeaderboard>(id).set(JSON.parse(JSON.stringify(leaderboard)));
    else
      await this.leaderboards.doc<DbLeaderboard>().set(JSON.parse(JSON.stringify(leaderboard)));
  }

  async updateUsers(userCollection: DbUsersCollection) {
    await this.checkAuthenticated();
    await this.globalData.doc<DbUsersCollection>("users").set(JSON.parse(JSON.stringify(userCollection)));
  }

  // ----- DELETE -----

  async deleteOldLobbies() {
    await this.checkAuthenticated();
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
    await this.checkAuthenticated();
    await this.deleteLobbySubCollections(id);
    await this.lobbies.doc<Lobby>(id).delete();
  }

  async deleteLobbySubCollections(id: string) {
    await this.checkAuthenticated();
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

  async deleteRun(id: string) {
    await this.checkAuthenticated();
    await this.runs.doc<DbRun>(id).delete();
  }
}
