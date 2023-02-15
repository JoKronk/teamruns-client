import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { Lobby } from '../common/lobby/lobby';
import { Run } from '../common/run/run';

@Injectable({
  providedIn: 'root'
})
export class FireStoreService {

  runs: AngularFirestoreCollection<Run>;
  lobbies: AngularFirestoreCollection<Lobby>;

  constructor(private firestore: AngularFirestore) { 
    this.runs = firestore.collection<Run>('runs');
    this.lobbies = firestore.collection<Lobby>('lobbies');
  }

  getLobbies() {
    return this.lobbies.valueChanges();
  }

  addLobby(lobby: Lobby) {
    console.log("creating lobby", lobby);
    this.lobbies.doc<Lobby>(lobby.id).set(JSON.parse(JSON.stringify(lobby)));
  }

  deleteLobby(lobbyId: string) {
    this.lobbies.doc<Lobby>(lobbyId).delete();
  }

  getRun(id: string) {
    return this.runs.doc(id).snapshotChanges();
  }

  addRun(run:Run) {
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    this.runs.doc<Run>(run.id).set(JSON.parse(JSON.stringify(run)));
  }

  updateRun(run: Run | undefined) {
    if (run) {
      this.runs.doc<Run>(run.id).set(JSON.parse(JSON.stringify(run)), {merge: true});
    }
  }
}
