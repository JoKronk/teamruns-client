export class ChatMessage {
    username: string | undefined;
    color: string;
    text: string;
    id: string;

    constructor(message: string, username: string | undefined = undefined, color: string | undefined = undefined) {
        this.id = crypto.randomUUID();
        this.text = message;
        this.username = username;
        this.color = color ?? "#ffffff";
    }
  }