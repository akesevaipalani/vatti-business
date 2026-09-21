type SyncEventListener = (event: { type: string; data: unknown; timestamp: number }) => void;

class SyncEventEmitter {
  private listeners: Set<SyncEventListener> = new Set();

  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  broadcast(type: string, data: unknown) {
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

  get activeSubscriberCount(): number {
    return this.listeners.size;
  }
}

// Global singleton across hot-reloads
const globalForSync = globalThis as unknown as {
  syncEventEmitter: SyncEventEmitter | undefined;
};

export const syncEvents = globalForSync.syncEventEmitter ?? new SyncEventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForSync.syncEventEmitter = syncEvents;
}
