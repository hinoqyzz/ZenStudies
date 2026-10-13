export interface SyncEvent {
  type: "notes" | "cards" | "pdfs" | "library" | "trash" | "session" | "preferences";
  id?: string;
  sourceId: string;
}

export interface SyncChannel {
  post(event: SyncEvent): void;
  subscribe(listener: (event: SyncEvent) => void): () => void;
}

export class MemorySyncChannel implements SyncChannel {
  private listeners = new Set<(event: SyncEvent) => void>();

  post(event: SyncEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: (event: SyncEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export class SyncBus {
  private outbound: ((event: SyncEvent) => void) | null = null;
  private readonly locals = new Set<(event: SyncEvent) => void>();

  constructor(
    private readonly sourceId: string,
    private readonly channel: SyncChannel,
  ) {}

  get id(): string {
    return this.sourceId;
  }

  bindOutbound(handler: (event: SyncEvent) => void): void {
    this.outbound = handler;
  }

  onLocal(listener: (event: SyncEvent) => void): () => void {
    this.locals.add(listener);
    return () => this.locals.delete(listener);
  }

  publish(event: Omit<SyncEvent, "sourceId">): void {
    const full: SyncEvent = { ...event, sourceId: this.sourceId };
    for (const listener of this.locals) listener(full);
    this.channel.post(full);
    this.outbound?.(full);
  }

  subscribe(listener: (event: SyncEvent) => void): () => void {
    return this.channel.subscribe((event) => {
      if (event.sourceId === this.sourceId) return;
      listener(event);
    });
  }
}

export function createBrowserSyncChannel(): SyncChannel {
  if (typeof BroadcastChannel === "undefined") return new MemorySyncChannel();
  const channel = new BroadcastChannel("zenstudies");
  return {
    post(event) {
      channel.postMessage(event);
    },
    subscribe(listener) {
      const onMessage = (message: MessageEvent<SyncEvent>) => listener(message.data);
      channel.addEventListener("message", onMessage);
      return () => channel.removeEventListener("message", onMessage);
    },
  };
}
