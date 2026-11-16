// The photo upload queue behind each upload area (BL-078 / SPEC-027 Part A).
// Photos start uploading as soon as they are added, at most three at a time
// so a phone on weak signal is not swamped. A photo that failed can be retried
// in place; one the server refused keeps its advice and can only be removed.
// Kept apart from React so it can be tested; useUpload wraps it.
import type { UploadOutcome } from "@/lib/photoUpload";

export const UPLOAD_CONCURRENCY = 3;

export type UploadStatus = "pending" | "uploading" | "done" | "failed" | "refused";

export type UploadEntry = {
  id: number;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  message?: string;
};

type Options = {
  upload: (file: File, onProgress: (percent: number) => void) => Promise<UploadOutcome>;
  /** Makes a thumbnail address for a photo. */
  preview: (file: File) => string;
  /** Called with how many photos uploaded, each time the queue empties. */
  onDrained: (uploaded: number) => void;
};

export class UploadSession {
  private entries: UploadEntry[] = [];
  private readonly listeners = new Set<() => void>();
  private nextId = 1;
  private running = 0;
  private uploadedThisBatch = 0;

  constructor(private readonly options: Options) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): readonly UploadEntry[] => this.entries;

  add(files: readonly File[]): void {
    const added = files.map((file) => ({
      id: this.nextId++,
      file,
      previewUrl: this.options.preview(file),
      status: "pending" as const,
      progress: 0,
    }));
    this.entries = [...this.entries, ...added];
    this.changed();
    this.startWaiting();
  }

  retry(id: number): void {
    const entry = this.entries.find((e) => e.id === id);
    if (entry?.status !== "failed") return;
    this.update(id, { status: "pending", progress: 0, message: undefined });
    this.startWaiting();
  }

  remove(id: number): void {
    if (this.entries.find((e) => e.id === id)?.status === "uploading") return;
    this.entries = this.entries.filter((e) => e.id !== id);
    this.changed();
  }

  private startWaiting(): void {
    while (this.running < UPLOAD_CONCURRENCY) {
      const next = this.entries.find((e) => e.status === "pending");
      if (!next) return;
      void this.run(next);
    }
  }

  private async run(entry: UploadEntry): Promise<void> {
    this.running++;
    this.update(entry.id, { status: "uploading", progress: 0 });
    const outcome = await this.options.upload(entry.file, (progress) => this.update(entry.id, { progress }));
    this.running--;
    if (outcome.kind === "done") {
      this.uploadedThisBatch++;
      this.update(entry.id, { status: "done", progress: 100 });
    } else {
      this.update(entry.id, { status: outcome.kind, message: outcome.message });
    }
    this.startWaiting();
    this.reportIfDrained();
  }

  private reportIfDrained(): void {
    const busy = this.entries.some((e) => e.status === "pending" || e.status === "uploading");
    if (busy) return;
    const uploaded = this.uploadedThisBatch;
    this.uploadedThisBatch = 0;
    this.options.onDrained(uploaded);
  }

  private update(id: number, patch: Partial<UploadEntry>): void {
    this.entries = this.entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    this.changed();
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}
