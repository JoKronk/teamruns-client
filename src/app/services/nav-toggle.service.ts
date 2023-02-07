import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NavToggleService {
    
  show: boolean = false;

  constructor() { }
  
  toggle() {
    this.show = !this.show;
  }
}
