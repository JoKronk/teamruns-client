import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { environment } from 'src/environments/environment';
import { CollectionName } from '../common/firestore/collection-name';
import { Lobby } from '../common/firestore/lobby';
import { Preset } from '../common/firestore/preset';
import { DataChannelEvent } from '../common/peer/data-channel-event';
import { RTCPeer } from '../common/peer/rtc-peer';
import { Run } from '../common/run/run';

@Injectable({
  providedIn: 'root'
})
export class FireStoreService {

  private runs: AngularFirestoreCollection<Run>;
  private lobbies: AngularFirestoreCollection<Lobby>;
  private isAuthenticated: boolean = false;

  constructor(public firestore: AngularFirestore, public auth: AngularFireAuth) {
    this.runs = firestore.collection<Run>(CollectionName.runs);
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

  async getRun(id: string) {
    this.checkAuthenticated();
    return (await this.runs.doc(id).ref.get()).data();
  }

  async addRun(run:Run) {
    this.checkAuthenticated();
    //class needs to be object, Object.assign({}, run); doesn't work either due to nested objects
    await this.runs.doc<Run>().set(JSON.parse(JSON.stringify(run)));
  }

  async getPreset(id: string) {
    this.checkAuthenticated();
    return (await this.firestore.collection<Preset>(CollectionName.presets).doc<Preset>(id).ref.get()).data();
  }
}
