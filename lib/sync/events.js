class SyncEventEmitter {
  constructor() {
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  broadcast(type, data) {
    const payload = {
      type,
      data,
      timestamp: Date.now(),
    };
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error("[SyncEvent] Error dispatching to listener:", err);
      }
    });
  }

  get activeSubscriberCount() {
    return this.listeners.size;
  }
}

const globalForSync = globalThis;
if (!globalForSync.syncEventEmitter) {
  globalForSync.syncEventEmitter = new SyncEventEmitter();
}

const syncEvents = globalForSync.syncEventEmitter;

module.exports = { syncEvents, SyncEventEmitter };
