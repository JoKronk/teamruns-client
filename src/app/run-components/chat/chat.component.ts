import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatMessage } from '@app/common/peer/chat-message';

@Component({
    selector: 'app-chat',
    templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
    imports: [CommonModule, FormsModule]
})
export class ChatComponent {

  message: string = "";
  @Input() chatMessages: ChatMessage[];
  @Output() onMessage: EventEmitter<string> = new EventEmitter<string>();

  constructor() {
    
  }

  sendMessage() {
    if (!this.message) return;

    this.onMessage.emit(this.message);
    this.message = "";
  }
}
