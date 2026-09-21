import { syncEvents } from "@/lib/sync/events";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection handshake
      const initialMessage = `event: connected\ndata: ${JSON.stringify({
        status: "connected",
        time: Date.now(),
        subscribers: syncEvents.activeSubscriberCount + 1,
      })}\n\n`;
      controller.enqueue(encoder.encode(initialMessage));

      // Subscribe to all broadcasted events
      const unsubscribe = syncEvents.subscribe((event) => {
        try {
          const message = `event: message\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          console.error("[SSE] Failed to enqueue event:", err);
          unsubscribe();
        }
      });

      // Keep connection alive with periodic heartbeats every 25s
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
          unsubscribe();
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
