import { getServerUrl } from "./api";

type SyncCallback = (event: { type: string; data: unknown }) => void;

class RealtimeSyncManager {
  private eventSource: EventSource | null = null;
  private listeners: Set<SyncCallback> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 2000;
  private isConnected = false;

  public subscribe(callback: SyncCallback): () => void {
    this.listeners.add(callback);
    if (!this.eventSource) {
      this.connect();
    }
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  public connect() {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    if (this.eventSource) return;

    const serverUrl = getServerUrl();
    const url = `${serverUrl}/api/sync/events`;

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.retryDelay = 2000;
      };

      this.eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          this.broadcast(parsed.type || "UNKNOWN", parsed.data);
        } catch {
          // ignore non-json messages (e.g. heartbeat pings)
        }
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.disconnect();
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.retryDelay = Math.min(this.retryDelay * 1.5, 30000);
      this.connect();
    }, this.retryDelay);
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }

  private broadcast(type: string, data: unknown) {
    this.listeners.forEach((listener) => {
      try {
        listener({ type, data });
      } catch (err) {
        console.error("Sync listener error:", err);
      }
    });
  }

  public get connected(): boolean {
    return this.isConnected;
  }
}

export const syncManager = new RealtimeSyncManager();
