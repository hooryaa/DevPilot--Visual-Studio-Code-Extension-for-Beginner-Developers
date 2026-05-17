// A tiny browser‑compatible event bus for the webview
type Callback = (payload: any) => void;

class MessageBus {
  private events: Record<string, Callback[]> = {};

  on(event: string, cb: Callback) {
    if (!this.events[event]) {this.events[event] = [];}
    this.events[event].push(cb);
  }

  off(event: string, cb: Callback) {
    if (!this.events[event]) {return;}
    this.events[event] = this.events[event].filter(fn => fn !== cb);
  }

  emit(event: string, payload?: any) {
    if (!this.events[event]) {return;}
    for (const cb of this.events[event]) {cb(payload);}
  }
}

export const messageBus = new MessageBus();
