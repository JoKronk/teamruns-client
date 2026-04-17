import { Injectable } from '@angular/core';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, getAuth, User } from '@angular/fire/auth';
import { CollectionReference, DocumentData, DocumentReference, Firestore, collection, query, collectionData, doc, getDoc, setDoc, and, where, docData, deleteDoc, getDocs, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions } from '@angular/fire/firestore';
import { getStorage, StorageReference, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { environment } from '@root/src/environments/environment';
import { CollectionName } from '../common/firestore/collection-name';
import { DbRun } from '../common/firestore/db-run';
import { Lobby } from '../common/firestore/lobby';
import { RTCConnection } from '../common/peer/rtc-connection';
import { DbUsersCollection } from '../common/firestore/db-users-collection';
import { CategoryOption } from '../common/run/category';
import { DbLeaderboard } from '../common/firestore/db-leaderboard';
import { DbPb } from '../common/firestore/db-pb';
import { DbUserProfile } from '../common/firestore/db-user-profile';
import { AccountReply } from '../dialogs/account-dialog/account-dialog.component';
import { DbLeaderboardPb } from '../common/firestore/db-leaderboard-pb';
import { DbRecordingFile } from '../common/firestore/db-recording-file';
import { Observable, catchError, map, of } from 'rxjs';
import pkg from '@root/package.json';

@Injectable({
  providedIn: 'root'
})
export class FireStoreService {

  private globalData: CollectionReference<DbUsersCollection>;
  private leaderboards: CollectionReference<DbLeaderboard>;
  private lobbies: CollectionReference<Lobby>;
  private personalBests: CollectionReference<DbPb>;
  private runs: CollectionReference<DbRun>;

  private recordings: StorageReference;

  private auth = getAuth();
  private isAuthenticated: boolean = false;
  private currentUser: User | null = null;

  constructor(public firestore: Firestore) {

    this.globalData = collection(firestore, CollectionName.globalData).withConverter(FireStoreService.convert<DbUsersCollection>());
    this.leaderboards = collection(firestore, CollectionName.leaderboards).withConverter(FireStoreService.convert<DbLeaderboard>());
    this.lobbies = collection(firestore, CollectionName.lobbies).withConverter(FireStoreService.convert<Lobby>());
    this.personalBests = collection(firestore, CollectionName.personalBests).withConverter(FireStoreService.convert<DbPb>());
    this.runs = collection(firestore, CollectionName.runs).withConverter(FireStoreService.convert<DbRun>());
    this.recordings = ref(getStorage(), CollectionName.recordings);
  }

  static convert<T>(): FirestoreDataConverter<T> {
    return {
      toFirestore(data: T): DocumentData {
        return data as DocumentData;
      },
      fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
        return snapshot.data(options) as T;
      },
    }
  }

  private async checkAuthenticated() { // !TODO: this currently has some problems in some case as not all firestore functions created here are async atm, but the user is usually already signed in in all use cases where it's not async..
    if (this.isAuthenticated) return;
    return await signInWithEmailAndPassword(this.auth, environment.firestoreUsername, environment.firestorePassword).then(() => {
      this.isAuthenticated = true;
      return;
    });
  }

  authenticateUsernamePw(user: DbUserProfile, pw: string) {
    return signInWithEmailAndPassword(this.auth, user.name + "@teamruns.web.app", pw).then((userCredential) => {
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
    return createUserWithEmailAndPassword(this.auth, username + "@teamruns.web.app", pw).then((userCredential) => {
      this.isAuthenticated = true;

      if (setAsCurrent)
        this.currentUser = userCredential.user;

      return new AccountReply(crypto.randomUUID(), true);
    }).catch((error) => {
      return new AccountReply("", false, error.message);
    });
  }

  async checkUserExists(name: string): Promise<boolean> {
    return signInWithEmailAndPassword(this.auth, name + "@teamruns.web.app", "none").then((userCredential) => {
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

  private getDocument<T>(collection: CollectionReference, document: string) {
    return getDoc(doc(collection, document).withConverter(FireStoreService.convert<T>()));
  }

  private getDocRef<T>(collection: CollectionReference, document: string | undefined = undefined) {
    if (!document)
      return doc(collection).withConverter(FireStoreService.convert<T>());
    else
      return doc(collection, document).withConverter(FireStoreService.convert<T>())
  }


  // ----- USER DATA -----

  async getUsers() { // NOTE: why only all? All users are stored in one array currently to reduce read cost when getting users for leaderboards and such, TLDR: Cost savings (but a bit scuffed)
    await this.checkAuthenticated();
    return (await getDoc(doc(this.globalData, "users").withConverter(FireStoreService.convert<DbUsersCollection>()))).data() ?? new DbUsersCollection();
  }

  async updateUsers(userCollection: DbUsersCollection) {
    await this.checkAuthenticated();
    await setDoc(this.getDocRef<DbUsersCollection>(this.globalData, "users"), JSON.parse(JSON.stringify(userCollection)));
  }
  


  // ----- LEADERBOARDS -----

  getLeaderboard(category: CategoryOption, sameLevel: boolean, players: number) {
    this.checkAuthenticated();
    return collectionData<DbLeaderboard>(query(this.leaderboards, and(where('category', '==', category), where('sameLevel', '==', sameLevel), where('players', '==', players))), {idField: 'id'});
  }

  getLeaderboards(category: CategoryOption, sameLevel: boolean, playersCounts: number[]) {
    this.checkAuthenticated();
    return collectionData<DbLeaderboard>(query(this.leaderboards, and(where('category', '==', category), where('sameLevel', '==', sameLevel), where('players', '==', playersCounts))), {idField: 'id'});
  }

  getWrs(category: CategoryOption, sameLevel: boolean, playerCount: number) {
    this.checkAuthenticated();
    return collectionData<DbPb>(query(this.personalBests, and(where('category', '==', category), where('sameLevel', '==', sameLevel), where('playerCount', '==', playerCount), where('wasWr', '==', true))), {idField: 'id'});
  }
  
  async putLeaderboard(leaderboard: DbLeaderboard) {
    await this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    const id = leaderboard.id;
    leaderboard.clearFrontendValues();

    console.log("Cat:" + leaderboard.category + " P:" + leaderboard.players + " S:" + leaderboard.sameLevel, leaderboard);
    if (id)
      await setDoc(this.getDocRef<DbLeaderboard>(this.leaderboards, id), JSON.parse(JSON.stringify(leaderboard)));
    else
      await setDoc(this.getDocRef<DbLeaderboard>(this.leaderboards, ''), JSON.parse(JSON.stringify(leaderboard)));
  }



  // ----- LOBBIES -----
  
  getLobbyDoc(id: string): DocumentReference<Lobby> {
    this.checkAuthenticated();
    return this.getDocRef<Lobby>(this.lobbies, id);
    //return this.lobbies.doc(id);
  }

  getOpenLobbies() {
    this.checkAuthenticated();
    return collectionData<Lobby>(query(this.lobbies, and(where('visible', '==', true), where('runData.buildVersion', '==', pkg.version))));
  }

  getUserLobby(userId: string) {
    this.checkAuthenticated();
    return collectionData<Lobby>(query(this.lobbies, and(where('runners', 'array-contains', userId))));
  }

  async addLobby(lobby: Lobby) {
    await this.checkAuthenticated();
    await setDoc(this.getDocRef<Lobby>(this.lobbies, lobby.id), JSON.parse(JSON.stringify(lobby)));
  }

  async updateLobby(lobby: Lobby) {
    await this.checkAuthenticated();
    await this.addLobby(lobby); //they happen to be the same command, just trying to avoid confusion when looking for an update method
  }

  async deleteOldLobbies() {
    await this.checkAuthenticated();
    const expireDate = new Date();
    expireDate.setHours(expireDate.getHours() - 4);

    (await getDocs(this.lobbies)).forEach(async (lobbySnapshot) => {
      let lobby = lobbySnapshot.data();
      if (new Date(lobby.creationDate) < expireDate) {
        await this.deleteLobby(lobbySnapshot.id);
      }
    });
  }

  async deleteLobby(id: string) {
    await this.checkAuthenticated();
    await this.deleteLobbySubCollections(id);
    deleteDoc(this.getDocRef<Lobby>(this.lobbies, id));
  }
  
  async deleteLobbySubCollections(id: string) {
    await this.checkAuthenticated();

    const peerSubcollection = collection(this.getDocRef<Lobby>(this.lobbies, id), CollectionName.peerConnections).withConverter(FireStoreService.convert<RTCConnection>());
    (await getDocs(peerSubcollection)).forEach(async (conSnapshot) => {
      deleteDoc(doc(peerSubcollection, conSnapshot.id)) // I suppose this should be the correct way of deleting these?
    });
  }



  // ----- PBS -----

  getPbs() {
    this.checkAuthenticated();
    return collectionData<DbPb>(this.personalBests, {idField: 'id'});
  }

  getPb(id: string) {
    this.checkAuthenticated();
    return docData(this.getDocRef<DbPb>(this.personalBests, id), {idField: 'id'});
  }

  getUsersCurrentPb(category: CategoryOption, sameLevel: boolean, userIds: string[]) {
    this.checkAuthenticated();
    return collectionData<DbPb>(query(this.personalBests, and(where('isCurrentPb', '==', true), where('category', '==', category), where('sameLevel', '==', sameLevel), where('userIds', '==', Object.fromEntries(DbPb.convertUserIds(userIds).entries())))), {idField: 'id'});
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
      await setDoc(this.getDocRef<DbPb>(this.personalBests, id), JSON.parse(JSON.stringify(pb)));
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

  downloadRecording(pbId: string): Promise<boolean> { //calls backend to fetch the file
    this.checkAuthenticated();
    return getDownloadURL(ref(this.recordings, pbId)).then((url) => {
      (window as any).electron.send('recordings-download', url);
      return true;
    }).catch((error) => {
      return false;
    });
  }

  async uploadRecording(recording: DbRecordingFile) {
    await this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    
    await uploadBytes(ref(this.recordings, recording.pdId), new Blob([JSON.stringify(recording)], {type: "application/json"}));
  }

  async deleteRecording(pbId: string) {
    await this.checkAuthenticated();
    deleteObject(ref(this.recordings, pbId));
  }



  // ----- RUNS -----

  async getRun(id: string) {
    await this.checkAuthenticated();
    return docData(this.getDocRef<DbRun>(this.runs, id));
  }

  getRuns() {
    this.checkAuthenticated();
    return collectionData<DbRun>(query(this.runs), {idField: 'id'});
  }

  getUserRuns(userId: string) {
    this.checkAuthenticated();
    return collectionData<DbRun>(query(this.runs, and(where('userIds.' + userId, '==', true))), {idField: 'id'});
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
      await setDoc(this.getDocRef<DbRun>(this.runs, id), JSON.parse(JSON.stringify(run)));
    else
      await setDoc(this.getDocRef<DbRun>(this.runs), JSON.parse(JSON.stringify(run)));
  }

  async deleteRun(id: string) {
    await this.checkAuthenticated();
    deleteDoc(this.getDocRef<DbRun>(this.runs, id));
  }



}
