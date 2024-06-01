export class ChatMessage {
    username: string | undefined;
    color: string;
    text: string;

    constructor(message: string, username: string | undefined = undefined, color: string | undefined = undefined) {
        this.text = message;
        this.username = username;
        this.color = color ?? "#ffffff";
    }
  }