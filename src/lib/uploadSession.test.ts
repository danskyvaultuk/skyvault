import { describe, expect, it, vi } from "vitest";
import { UploadSession, UPLOAD_CONCURRENCY } from "./uploadSession";
import type { UploadOutcome } from "./photoUpload";

const photo = (name: string) => new File(["x"], name, { type: "image/jpeg" });

/** An uploader whose calls stay open until the test settles them. */
function controlledUploader() {
  const calls: { name: string; settle: (o: UploadOutcome) => void; onProgress: (p: number) => void }[] = [];
  const upload = vi.fn(
    (file: File, onProgress: (p: number) => void) =>
      new Promise<UploadOutcome>((resolve) => calls.push({ name: file.name, settle: resolve, onProgress }))
  );
  return { upload, calls };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function session(upload: (f: File, p: (n: number) => void) => Promise<UploadOutcome>) {
  const drained = vi.fn();
  const s = new UploadSession({ upload, preview: (f) => `blob:${f.name}`, onDrained: drained });
  return { s, drained };
}

describe("UploadSession (BL-078 / SPEC-027 Part A)", () => {
  it("A1: adding photos starts their upload, with no separate step", async () => {
    const { upload, calls } = controlledUploader();
    const { s } = session(upload);
    s.add([photo("a.jpg")]);
    expect(calls.map((c) => c.name)).toEqual(["a.jpg"]);
    expect(s.getSnapshot()[0].status).toBe("uploading");
    expect(s.getSnapshot()[0].previewUrl).toBe("blob:a.jpg");
  });

  it("A2: uploads at most 3 at once, starting the rest as earlier ones finish", async () => {
    expect(UPLOAD_CONCURRENCY).toBe(3);
    const { upload, calls } = controlledUploader();
    const { s } = session(upload);
    s.add(["1", "2", "3", "4", "5"].map((n) => photo(`${n}.jpg`)));
    expect(calls).toHaveLength(3);
    expect(s.getSnapshot().map((e) => e.status)).toEqual(["uploading", "uploading", "uploading", "pending", "pending"]);
    calls[0].settle({ kind: "done", s3Key: "k1" });
    await tick();
    expect(calls).toHaveLength(4);
    expect(s.getSnapshot().filter((e) => e.status === "uploading")).toHaveLength(3);
  });

  it("shows each photo's progress", async () => {
    const { upload, calls } = controlledUploader();
    const { s } = session(upload);
    s.add([photo("a.jpg")]);
    calls[0].onProgress(40);
    expect(s.getSnapshot()[0].progress).toBe(40);
  });

  it("A3: a failed photo can be retried in place, and then succeeds", async () => {
    const { upload, calls } = controlledUploader();
    const { s } = session(upload);
    s.add([photo("a.jpg")]);
    calls[0].settle({ kind: "failed", message: "Check your signal" });
    await tick();
    const [failed] = s.getSnapshot();
    expect(failed.status).toBe("failed");
    expect(failed.message).toBe("Check your signal");
    s.retry(failed.id);
    expect(calls).toHaveLength(2);
    expect(calls[1].name).toBe("a.jpg");
    calls[1].settle({ kind: "done", s3Key: "k" });
    await tick();
    expect(s.getSnapshot()[0].status).toBe("done");
  });

  it("A3: a refused photo keeps the server's advice and cannot be retried, only removed", async () => {
    const { upload, calls } = controlledUploader();
    const { s } = session(upload);
    s.add([photo("a.jpg")]);
    calls[0].settle({ kind: "refused", message: "Too blurry" });
    await tick();
    const [refused] = s.getSnapshot();
    expect(refused.status).toBe("refused");
    expect(refused.message).toBe("Too blurry");
    s.retry(refused.id);
    expect(calls).toHaveLength(1);
    s.remove(refused.id);
    expect(s.getSnapshot()).toHaveLength(0);
  });

  it("does not remove a photo while it is uploading", () => {
    const { upload } = controlledUploader();
    const { s } = session(upload);
    s.add([photo("a.jpg")]);
    s.remove(s.getSnapshot()[0].id);
    expect(s.getSnapshot()).toHaveLength(1);
  });

  it("A4: reports how many uploaded once the queue has drained", async () => {
    const { upload, calls } = controlledUploader();
    const { s, drained } = session(upload);
    s.add([photo("a.jpg"), photo("b.jpg")]);
    calls[0].settle({ kind: "done", s3Key: "k1" });
    await tick();
    expect(drained).not.toHaveBeenCalled();
    calls[1].settle({ kind: "failed", message: "x" });
    await tick();
    expect(drained).toHaveBeenCalledTimes(1);
    expect(drained).toHaveBeenCalledWith(1);
  });

  it("tells subscribers when the list changes", () => {
    const { upload } = controlledUploader();
    const { s } = session(upload);
    const listener = vi.fn();
    const unsubscribe = s.subscribe(listener);
    s.add([photo("a.jpg")]);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});
