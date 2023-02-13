import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { Run } from '../common/run/run';

@Injectable({
  providedIn: 'root'
})
export class FireStoreService {

  runs: AngularFirestoreCollection<Run>;

  constructor(private firestore: AngularFirestore) { 
    this.runs = firestore.collection<Run>('runs');
  }

  getRuns() {
    return this.runs.valueChanges();
  }

  getRun(id: string) {
    return this.runs.doc(id).valueChanges();
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
