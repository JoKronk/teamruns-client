import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { CollectionName } from '../common/firestore/collection-name';
import { Lobby } from '../common/firestore/lobby';
import { Run } from '../common/run/run';

@Injectable({
  providedIn: 'root'
})
export class FireStoreService {

  runs: AngularFirestoreCollection<Run>;
  lobbies: AngularFirestoreCollection<Lobby>;
  openLobbies: AngularFirestoreCollection<Lobby>;

  constructor(private firestore: AngularFirestore) { 
    this.runs = firestore.collection<Run>(CollectionName.runs);
    this.lobbies = firestore.collection<Lobby>(CollectionName.lobbies);
    this.openLobbies = firestore.collection<Lobby>(CollectionName.lobbies, ref => ref.where('visible', '==', true));
  }

  getOpenLobbies() {
    return this.openLobbies.valueChanges();
  }

  async addLobby(lobby: Lobby) {
    await this.lobbies.doc<Lobby>(lobby.id).set(JSON.parse(JSON.stringify(lobby)));
  }

  async deleteLobby(lobbyId: string) {
    await this.lobbies.doc<Lobby>(lobbyId).delete();
  }

  async getRun(id: string) {
    return (await this.runs.doc(id).ref.get()).data();
  }

  async addRun(run:Run) {
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    await this.runs.doc<Run>().set(JSON.parse(JSON.stringify(run)));
  }
}
