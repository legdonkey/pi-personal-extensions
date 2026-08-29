export interface TimelineEntry {
  readonly id: string;
  readonly taskEpoch: number;
  readonly sourceSequence: number;
  readonly sourceKey: string;
  readonly original: string;
  readonly status: "pending" | "translated";
  readonly translated?: string;
}

export interface TranslationJob {
  readonly sourceKey: string;
  readonly cacheKey: string;
  readonly original: string;
  readonly translate: (signal: AbortSignal) => Promise<string>;
}

export type SchedulerWarning = "overflow" | "translation";

export interface TranslationSchedulerOptions {
  readonly onChange?: (timeline: readonly TimelineEntry[]) => void;
  readonly onWarning?: (kind: SchedulerWarning, error?: Error) => void;
  readonly cacheSize?: number;
  readonly maxPending?: number;
}

interface PendingJob {
  readonly input: TranslationJob;
  readonly entryIds: string[];
  readonly taskEpoch: number;
}

export class TranslationScheduler {
  private readonly onChange?: TranslationSchedulerOptions["onChange"];
  private readonly onWarning?: TranslationSchedulerOptions["onWarning"];
  private readonly cacheSize: number;
  private readonly maxPending: number;
  private readonly queue: PendingJob[] = [];
  private readonly seenSourceKeys = new Set<string>();
  private readonly pendingByCacheKey = new Map<string, PendingJob>();
  private readonly cache = new Map<string, string>();
  private readonly warned = new Set<SchedulerWarning>();
  private timeline: TimelineEntry[] = [];
  private taskController = new AbortController();
  private taskEpoch = 1;
  private sourceSequence = 0;
  private runningEpoch: number | undefined;

  constructor(options: TranslationSchedulerOptions = {}) {
    this.onChange = options.onChange;
    this.onWarning = options.onWarning;
    this.cacheSize = Math.max(1, options.cacheSize ?? 128);
    this.maxPending = Math.max(1, options.maxPending ?? 32);
  }

  enqueue(input: TranslationJob): boolean {
    if (this.seenSourceKeys.has(input.sourceKey)) return false;

    const cached = this.readCache(input.cacheKey);
    const pendingCandidate = this.pendingByCacheKey.get(input.cacheKey);
    const shared =
      pendingCandidate?.taskEpoch === this.taskEpoch
        ? pendingCandidate
        : undefined;
    if (
      cached === undefined &&
      !shared &&
      this.pendingByCacheKey.size >= this.maxPending
    ) {
      this.warnOnce("overflow");
      return false;
    }
    this.seenSourceKeys.add(input.sourceKey);

    const sourceSequence = ++this.sourceSequence;
    const entryId = `${this.taskEpoch}:${sourceSequence}`;
    const entry = {
      id: entryId,
      taskEpoch: this.taskEpoch,
      sourceSequence,
      sourceKey: input.sourceKey,
      original: input.original,
    } as const;
    if (cached !== undefined) {
      this.timeline.push({
        ...entry,
        status: "translated",
        translated: cached,
      });
      this.emitChange();
      return true;
    }

    this.timeline.push({ ...entry, status: "pending" });
    if (shared) {
      shared.entryIds.push(entryId);
      this.emitChange();
      return true;
    }

    const pending: PendingJob = {
      input,
      entryIds: [entryId],
      taskEpoch: this.taskEpoch,
    };
    this.pendingByCacheKey.set(input.cacheKey, pending);
    this.queue.push(pending);
    this.emitChange();
    void this.drain();
    return true;
  }

  getTimeline(): readonly TimelineEntry[] {
    return this.timeline.map((entry) => ({ ...entry }));
  }

  reset(reason: string, options: { clearCache?: boolean } = {}): void {
    this.taskController.abort(new DOMException(reason, "AbortError"));
    this.taskController = new AbortController();
    this.taskEpoch += 1;
    this.sourceSequence = 0;
    this.queue.length = 0;
    this.timeline = [];
    this.seenSourceKeys.clear();
    this.pendingByCacheKey.clear();
    this.warned.clear();
    if (options.clearCache) this.cache.clear();
    this.emitChange();
  }

  private async drain(): Promise<void> {
    const workerEpoch = this.taskEpoch;
    const workerController = this.taskController;
    if (this.runningEpoch === workerEpoch) return;
    this.runningEpoch = workerEpoch;

    try {
      while (workerEpoch === this.taskEpoch && this.queue.length > 0) {
        const pending = this.queue.shift();
        if (!pending) continue;

        try {
          const translated = await pending.input.translate(
            workerController.signal,
          );
          if (
            workerController.signal.aborted ||
            pending.taskEpoch !== this.taskEpoch
          ) {
            continue;
          }
          this.writeCache(pending.input.cacheKey, translated);
          const entryIds = new Set(pending.entryIds);
          this.timeline = this.timeline.map((entry) =>
            entryIds.has(entry.id)
              ? { ...entry, status: "translated", translated }
              : entry,
          );
          this.emitChange();
        } catch (cause) {
          if (pending.taskEpoch !== this.taskEpoch) continue;
          const error = toError(cause);
          const entryIds = new Set(pending.entryIds);
          this.timeline = this.timeline.filter(
            (entry) => !entryIds.has(entry.id),
          );
          if (!workerController.signal.aborted && !isAbortError(error)) {
            this.warnOnce("translation", error);
          }
          this.emitChange();
        } finally {
          if (
            this.pendingByCacheKey.get(pending.input.cacheKey) === pending
          ) {
            this.pendingByCacheKey.delete(pending.input.cacheKey);
          }
        }
      }
    } finally {
      if (this.runningEpoch === workerEpoch) this.runningEpoch = undefined;
    }
  }

  private readCache(key: string): string | undefined {
    const value = this.cache.get(key);
    if (value === undefined) return undefined;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  private writeCache(key: string, value: string): void {
    this.cache.delete(key);
    this.cache.set(key, value);
    while (this.cache.size > this.cacheSize) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
  }

  private warnOnce(kind: SchedulerWarning, error?: Error): void {
    if (this.warned.has(kind)) return;
    this.warned.add(kind);
    this.onWarning?.(kind, error);
  }

  private emitChange(): void {
    this.onChange?.(this.getTimeline());
  }
}

function isAbortError(error: Error): boolean {
  return error.name === "AbortError";
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}
