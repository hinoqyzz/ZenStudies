export interface SaveSnapshot<TContent = unknown> {
  noteId: string;
  title: string;
  text: string;
  content: TContent;
  subjectId: string | null;
  baseRevision: number;
  generation: number;
}

export class AutosaveQueue {
  private tail: Promise<void> = Promise.resolve();
  private latest = new Map<string, number>();
  private tokens = new Map<string, number>();

  enqueue(key: string, task: () => Promise<void>): Promise<void> {
    const token = (this.tokens.get(key) ?? 0) + 1;
    this.tokens.set(key, token);
    this.latest.set(key, token);
    const run = this.tail.then(async () => {
      if (this.latest.get(key) !== token) return;
      await task();
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

export interface AutosaveControllerOptions<TContent = unknown> {
  noteId: string;
  delayMs?: number;
  queue?: AutosaveQueue;
  schedule?: (fn: () => void, ms: number) => number;
  cancel?: (id: number) => void;
  persist: (snapshot: SaveSnapshot<TContent>) => Promise<void>;
  onStatus?: (status: "saving" | "saved" | "error", message?: string) => void;
}

export class AutosaveController<TContent = unknown> {
  private generation = 0;
  private timer: number | null = null;
  private latest: SaveSnapshot<TContent> | null = null;
  private readonly delayMs: number;
  private readonly queue: AutosaveQueue;
  private readonly schedule: (fn: () => void, ms: number) => number;
  private readonly cancelTimer: (id: number) => void;

  constructor(private readonly options: AutosaveControllerOptions<TContent>) {
    this.delayMs = options.delayMs ?? 600;
    this.queue = options.queue ?? new AutosaveQueue();
    this.schedule = options.schedule ?? ((fn, ms) => window.setTimeout(fn, ms));
    this.cancelTimer = options.cancel ?? ((id) => window.clearTimeout(id));
  }

  push(snapshot: Omit<SaveSnapshot<TContent>, "generation" | "noteId">): void {
    this.generation += 1;
    this.latest = { ...snapshot, noteId: this.options.noteId, generation: this.generation };
    if (this.timer !== null) this.cancelTimer(this.timer);
    const generation = this.generation;
    this.timer = this.schedule(() => {
      this.timer = null;
      void this.flushGeneration(generation);
    }, this.delayMs);
  }

  async flush(): Promise<void> {
    if (this.timer !== null) {
      this.cancelTimer(this.timer);
      this.timer = null;
    }
    await this.flushGeneration(this.generation);
  }

  retry(): Promise<void> {
    return this.flush();
  }

  hasPending(): boolean {
    return this.timer !== null || this.latest !== null;
  }

  private async flushGeneration(generation: number): Promise<void> {
    const snapshot = this.latest;
    if (!snapshot || snapshot.generation !== generation) return;
    this.options.onStatus?.("saving");
    try {
      await this.queue.enqueue(this.options.noteId, async () => {
        if (!this.latest || this.latest.generation !== generation) return;
        await this.options.persist(this.latest);
      });
      if (this.latest?.generation === generation) {
        this.latest = null;
        this.options.onStatus?.("saved");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar.";
      this.options.onStatus?.("error", message);
      throw error;
    }
  }
}

const flushers = new Set<() => Promise<void>>();

export function registerFlusher(flusher: () => Promise<void>): () => void {
  flushers.add(flusher);
  return () => flushers.delete(flusher);
}

export async function flushAllSaves(): Promise<{ failed: boolean; message: string }> {
  const tasks = [...flushers].map(async (flusher) => flusher());
  const results = await Promise.allSettled(tasks);
  const failed = results.find((result) => result.status === "rejected");
  if (failed && failed.status === "rejected") {
    const reason = failed.reason;
    return {
      failed: true,
      message: reason instanceof Error ? reason.message : "Não foi possível salvar.",
    };
  }
  return { failed: false, message: "" };
}
