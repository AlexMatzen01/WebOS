export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const unsub = this.on(event, (payload) => {
      unsub();
      handler(payload);
    });
  }

  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event, payload = {}) {
    for (const handler of this.listeners.get(event) ?? []) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[EventBus] Handler error for ${event}`, error);
      }
    }
    for (const handler of this.listeners.get('*') ?? []) {
      handler({ event, payload });
    }
  }
}
