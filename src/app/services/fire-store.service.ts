import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { environment } from 'src/environments/environment';
import { CollectionName } from '../common/firestore/collection-name';
import { Lobby } from '../common/firestore/lobby';
import { Preset } from '../common/firestore/preset';
import { Run } from '../common/run/run';

@Injectable({
  providedIn: 'root'
})
export class FireStoreService {

  private runs: AngularFirestoreCollection<Run>;
  private lobbies: AngularFirestoreCollection<Lobby>;

  constructor(public firestore: AngularFirestore, public auth: AngularFireAuth) {
    this.runs = firestore.collection<Run>(CollectionName.runs);
    this.lobbies = firestore.collection<Lobby>(CollectionName.lobbies);
    this.auth.signInWithEmailAndPassword(environment.firestoreUsername, environment.firestorePassword);
  }

  getOpenLobbies() {
    return this.firestore.collection<Lobby>(CollectionName.lobbies, ref => ref.where('visible', '==', true)).valueChanges();
  }

  getUserLobby(userId: string) {
    return this.firestore.collection<Lobby>(CollectionName.lobbies, ref => ref.where('runners', 'array-contains', userId)).valueChanges();
  }

  getLobbyDoc(id: string) {
    return this.firestore.collection<Lobby>(CollectionName.lobbies).doc(id);
  }

  async addLobby(lobby: Lobby) {
    await this.lobbies.doc<Lobby>(lobby.id).set(JSON.parse(JSON.stringify(lobby)));
  }

  async updateLobby(lobby: Lobby) {
    await this.addLobby(lobby); //they happen to be the same command, just trying to avoid confusion when looking for an update method
  }

  async deleteOldLobbies() {
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
    let lobbyConnections = this.lobbies.doc<Lobby>(id).collection(CollectionName.peerConnections);
    (await lobbyConnections.ref.get()).forEach(conSnapshot => {
      lobbyConnections.doc<Lobby>(conSnapshot.id).delete();
    });
    this.lobbies.doc<Lobby>(id).delete();
  }

  async getRun(id: string) {
    return (await this.runs.doc(id).ref.get()).data();
  }

  async addRun(run:Run) {
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    await this.runs.doc<Run>().set(JSON.parse(JSON.stringify(run)));
  }

  async getPreset(id: string) {
    return (await this.firestore.collection<Preset>(CollectionName.presets).doc<Preset>(id).ref.get()).data();
  }
}
