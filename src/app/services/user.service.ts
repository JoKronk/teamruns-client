import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  displayName: string;
  twitchUsername: string;

  constructor() { }
}
