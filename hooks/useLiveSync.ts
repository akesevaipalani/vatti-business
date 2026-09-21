"use client";

import { useEffect, useState } from "react";

export interface SyncEventPayload {
  type: string;
  data: unknown;
  timestamp: number;
}

export function useLiveSync(onEvent?: (event: SyncEventPayload) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SyncEventPayload | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    function connect() {
      try {
        eventSource = new EventSource("/api/sync/events");

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.addEventListener("connected", () => {
          setIsConnected(true);
        });

        eventSource.addEventListener("message", (e) => {
          try {
            const parsed = JSON.parse(e.data) as SyncEventPayload;
            setLastEvent(parsed);
            if (onEvent) onEvent(parsed);

            // Also dispatch window custom event for decoupled components
            window.dispatchEvent(
              new CustomEvent("vatti:sync", { detail: parsed })
            );
          } catch (err) {
            console.error("[useLiveSync] Parse error:", err);
          }
        });

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource?.close();
          // Attempt reconnection after 3 seconds
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 5000);
      }
    }

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, [onEvent]);

  return { isConnected, lastEvent };
}
