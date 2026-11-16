import { describe, expect, it, vi } from "vitest";
import { uploadPhoto, type PutFile } from "./photoUpload";

const FILE = new File(["roof"], "IMG_1.jpg", { type: "image/jpeg" });

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

/** A fetch that answers the presign call, then the register call. */
function server(register: Response) {
  return vi
    .fn()
    .mockResolvedValueOnce(json(200, { s3Key: "surveys/s1/images/a.jpg", uploadUrl: "https://bucket.example/put" }))
    .mockResolvedValueOnce(register);
}

const putOk: PutFile = vi.fn(async (_url, _file, onProgress) => {
  onProgress(50);
  onProgress(100);
  return 200;
});

describe("uploadPhoto (BL-078 / SPEC-027 A3)", () => {
  it("presigns, sends the photo with progress, registers it with its checklist label, and returns its key", async () => {
    const fetchImpl = server(json(201, { id: "img-1" }));
    const progress: number[] = [];
    const outcome = await uploadPhoto(
      { surveyId: "s1", file: FILE, roofParts: ["side"], onProgress: (p) => progress.push(p) },
      { fetch: fetchImpl, put: putOk }
    );
    expect(outcome).toEqual({ kind: "done", s3Key: "surveys/s1/images/a.jpg" });
    expect(progress).toEqual([50, 100]);
    const registered = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(registered).toMatchObject({ s3Key: "surveys/s1/images/a.jpg", roofParts: ["side"], sizeBytes: FILE.size });
  });

  it("returns the server's photo advice as refused, so it is not retried", async () => {
    const fetchImpl = server(json(400, { error: "Photo refused", guidance: "This photo is too blurry. Hold the phone steady." }));
    const outcome = await uploadPhoto({ surveyId: "s1", file: FILE, onProgress: () => {} }, { fetch: fetchImpl, put: putOk });
    expect(outcome).toEqual({ kind: "refused", message: "This photo is too blurry. Hold the phone steady." });
  });

  it("treats a storage failure as failed, so it can be retried", async () => {
    const fetchImpl = server(json(201, {}));
    const outcome = await uploadPhoto(
      { surveyId: "s1", file: FILE, onProgress: () => {} },
      { fetch: fetchImpl, put: vi.fn(async () => 503) }
    );
    expect(outcome.kind).toBe("failed");
  });

  it("treats a lost connection as failed", async () => {
    const outcome = await uploadPhoto(
      { surveyId: "s1", file: FILE, onProgress: () => {} },
      { fetch: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")), put: putOk }
    );
    expect(outcome.kind).toBe("failed");
    expect(outcome.kind === "failed" && outcome.message).toMatch(/signal/i);
  });

  it("treats a server error while registering as failed", async () => {
    const outcome = await uploadPhoto({ surveyId: "s1", file: FILE, onProgress: () => {} }, { fetch: server(json(500, {})), put: putOk });
    expect(outcome.kind).toBe("failed");
  });
});
