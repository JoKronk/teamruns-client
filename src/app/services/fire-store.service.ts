import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { AngularFireStorage, AngularFireStorageReference } from '@angular/fire/compat/storage';
import { environment } from 'src/environments/environment';
import { CollectionName } from '../common/firestore/collection-name';
import { DbRun } from '../common/firestore/db-run';
import { Lobby } from '../common/firestore/lobby';
import { RTCPeer } from '../common/peer/rtc-peer';
import { DbUsersCollection } from '../common/firestore/db-users-collection';
import { CategoryOption } from '../common/run/category';
import { DbLeaderboard } from '../common/firestore/db-leaderboard';
import { DbPb } from '../common/firestore/db-pb';
import { DbUserProfile } from '../common/firestore/db-user-profile';
import { AccountReply } from '../dialogs/account-dialog/account-dialog.component';
import { DbLeaderboardPb } from '../common/firestore/db-leaderboard-pb';
import { DbRecordingFile } from '../common/firestore/db-recording-file';
import { Observable, catchError, map, of } from 'rxjs';
import pkg from 'app/package.json';

@Injectable({
  providedIn: 'root'
})
export class FireStoreService {

  private globalData: AngularFirestoreCollection<DbUsersCollection>;
  private leaderboards: AngularFirestoreCollection<DbLeaderboard>;
  private lobbies: AngularFirestoreCollection<Lobby>;
  private personalBests: AngularFirestoreCollection<DbPb>;
  private recordings: AngularFireStorageReference;
  private runs: AngularFirestoreCollection<DbRun>;

  private isAuthenticated: boolean = false;
  private currentUser: firebase.default.User | null = null;

  constructor(public firestore: AngularFirestore, public storage: AngularFireStorage, public auth: AngularFireAuth) {

    this.globalData = firestore.collection<DbUsersCollection>(CollectionName.globalData);
    this.leaderboards = firestore.collection<DbLeaderboard>(CollectionName.leaderboards);
    this.lobbies = firestore.collection<Lobby>(CollectionName.lobbies);
    this.personalBests = firestore.collection<DbPb>(CollectionName.personalBests);
    this.recordings = storage.ref(CollectionName.recordings);
    this.runs = firestore.collection<DbRun>(CollectionName.runs);
  }

  private async checkAuthenticated() { // !TODO: this currently has some problems in some case as not all firestore functions created here are async atm, but the user is usually already signed in in all use cases where it's not async..
    if (this.isAuthenticated) return;
    return await this.auth.signInWithEmailAndPassword(environment.firestoreUsername, environment.firestorePassword).then(() => {
      this.isAuthenticated = true;
      return;
    });
  }

  authenticateUsernamePw(user: DbUserProfile, pw: string) {
    return this.auth.signInWithEmailAndPassword(user.name + "@teamruns.web.app", pw).then((userCredential) => {
      this.isAuthenticated = true;
      this.currentUser = userCredential.user;
      return true;
    }).catch(error => {
      return false;
    });
  }



  // ----- USER CREATION -----

  createUser(username: string, pw: string, setAsCurrent: boolean = true): Promise<AccountReply> { //firebase forces it to be an email to doesn't require it to exist..
    this.checkAuthenticated();
    return this.auth.createUserWithEmailAndPassword(username + "@teamruns.web.app", pw).then((userCredential) => {
      this.isAuthenticated = true;

      if (setAsCurrent)
        this.currentUser = userCredential.user;

      return new AccountReply(crypto.randomUUID(), true);
    }).catch((error: firebase.default.FirebaseError) => {
      return new AccountReply("", false, error.message);
    });
  }

  async checkUserExists(name: string): Promise<boolean> {
    return this.auth.signInWithEmailAndPassword(name + "@teamruns.web.app", "none").then((userCredential) => {
      return true;
    }).catch(error => {
      return (error.message as string).startsWith("Firebase: The password is invalid or the user does not have a password.");
    });
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



  // ----- USER DATA -----

  async getUsers() { // NOTE: why only all? All users are stored in one array currently to reduce read cost when getting users for leaderboards and such, TLDR: Cost savings (but a bit scuffed)
    await this.checkAuthenticated();
    return (await this.globalData.doc("users").ref.get()).data();
  }

  async updateUsers(userCollection: DbUsersCollection) {
    await this.checkAuthenticated();
    await this.globalData.doc<DbUsersCollection>("users").set(JSON.parse(JSON.stringify(userCollection)));
  }
  


  // ----- LEADERBOARDS -----

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
  
  async putLeaderboard(leaderboard: DbLeaderboard) {
    await this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    const id = leaderboard.id;
    leaderboard.clearFrontendValues();

    console.log("Cat:" + leaderboard.category + " P:" + leaderboard.players + " S:" + leaderboard.sameLevel, leaderboard);
    if (id)
      await this.leaderboards.doc<DbLeaderboard>(id).set(JSON.parse(JSON.stringify(leaderboard)));
    else
      await this.leaderboards.doc<DbLeaderboard>().set(JSON.parse(JSON.stringify(leaderboard)));
  }



  // ----- LOBBIES -----
  
  getLobbyDoc(id: string) {
    this.checkAuthenticated();
    return this.lobbies.doc(id);
  }

  getOpenLobbies() {
    this.checkAuthenticated();
    return this.firestore.collection<Lobby>(CollectionName.lobbies, ref => ref.where('visible', '==', true).where('runData.buildVersion', '==', pkg.version)).valueChanges();
  }

  getUserLobby(userId: string) {
    this.checkAuthenticated();
    return this.firestore.collection<Lobby>(CollectionName.lobbies, ref => ref.where('runners', 'array-contains', userId)).valueChanges();
  }

  async addLobby(lobby: Lobby) {
    await this.checkAuthenticated();
    await this.lobbies.doc<Lobby>(lobby.id).set(JSON.parse(JSON.stringify(lobby)));
  }

  async updateLobby(lobby: Lobby) {
    await this.checkAuthenticated();
    await this.addLobby(lobby); //they happen to be the same command, just trying to avoid confusion when looking for an update method
  }

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
  }



  // ----- PBS -----

  getPbs() {
    this.checkAuthenticated();
    return this.personalBests.valueChanges({idField: 'id'});
  }

  getPb(id: string) {
    this.checkAuthenticated();
    return this.personalBests.doc(id).valueChanges({idField: 'id'});
  }

  getUsersCurrentPb(category: CategoryOption, sameLevel: boolean, userIds: string[]) {
    this.checkAuthenticated();
    return this.firestore.collection<DbPb>(CollectionName.personalBests, ref => ref.where('isCurrentPb', '==', true).where('category', '==', category).where('sameLevel', '==', sameLevel).where('userIds', '==', Object.fromEntries(DbPb.convertUserIds(userIds).entries()))).valueChanges({idField: 'id'});
  } 

  async addPb(pb: DbPb) {
    await this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    if (!(pb instanceof DbPb))
      pb = Object.assign(new DbPb(), pb);

    if (pb.userIds instanceof Map)
      pb.userIds = Object.fromEntries(pb.userIds);
    
    const id = pb.id;

    pb.clearFrontendValues();
    if (id)
      await this.personalBests.doc<DbPb>(id).set(JSON.parse(JSON.stringify(pb)));
  }

  async updatePb(pb: DbPb) {
    const pbId = pb.id;
    await this.addPb(pb);

    //update leaderboard comments
    const boardSubscription = this.getLeaderboard(pb.category, pb.sameLevel, pb.playerCount).subscribe(boards => {
      boardSubscription.unsubscribe();
      if (boards.length !== 1)
        return false;
      
      let userIds: string[] = (pb.userIds instanceof Map) ? Array.from(pb.userIds.keys()) : Array.from(new Map(Object.entries(pb.userIds)).keys());
      
      boards[0] = Object.assign(new DbLeaderboard(boards[0].category, boards[0].sameLevel, boards[0].players), boards[0]);
      boards[0].pbs.forEach((lbPb, index) => {
        boards[0].pbs[index] = Object.assign(new DbLeaderboardPb(), lbPb);
        if (lbPb.id! !== undefined && lbPb.id === pbId || lbPb.userIds.sort().join(',') === userIds.sort().join(',')) {
          boards[0].pbs[index].userContent = pb.userContent;
        }
      });
      this.putLeaderboard(boards[0]);
      return;
    });
  }



  // ----- RECORDINGS -----

  downloadRecording(pbId: string): Observable<boolean> { //calls backend to fetch the file
    this.checkAuthenticated();
    return this.recordings.child(pbId).getDownloadURL().pipe(
      map((url: URL) => {
        (window as any).electron.send('recordings-download', url);
        return true;
      }),
      catchError(error => {
        return of (false);
      })
    );
  }

  async uploadRecording(recording: DbRecordingFile) {
    await this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    
    await this.recordings.child(recording.pdId).put(new Blob([JSON.stringify(recording)], {type: "application/json"}));
  }

  async deleteRecording(pbId: string) {
    await this.checkAuthenticated();
    this.recordings.child(pbId).delete();
  }



  // ----- RUNS -----

  async getRun(id: string) {
    await this.checkAuthenticated();
    return (await this.runs.doc(id).ref.get()).data();
  }

  getRuns() {
    this.checkAuthenticated();
    return this.runs.valueChanges({idField: 'id'});
  }

  getUserRuns(userId: string) {
    this.checkAuthenticated();
    return this.firestore.collection<DbRun>(CollectionName.runs, ref => ref.where('userIds.' + userId, '==', true)).valueChanges({idField: 'id'});
  }

  async addRun(run: DbRun) {
    await this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    if (!(run instanceof DbRun))
      run = Object.assign(new DbRun(), run);
    
    if (run.userIds instanceof Map)
      run.userIds = Object.fromEntries(run.userIds);
    
    run.clearFrontendValues();
    
    const id = run.id;
    run.id = undefined;
    if (id)
      await this.runs.doc<DbRun>(id).set(JSON.parse(JSON.stringify(run)));
    else
      await this.runs.doc<DbRun>().set(JSON.parse(JSON.stringify(run)));
  }

  async deleteRun(id: string) {
    await this.checkAuthenticated();
    await this.runs.doc<DbRun>(id).delete();
  }

  
  async getCheckForUpdate() { 
    await this.checkAuthenticated();
    return (await this.globalData.doc<ClientUpdate>("update").ref.get()).data();
  }

}

export class ClientUpdate {
  available: boolean;
  message: string;
  blockAccess: string;
}
