import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UploadFileList } from "./upload-file-list";
import type { UploadEntry } from "@/lib/uploadSession";

const entry = (over: Partial<UploadEntry>): UploadEntry => ({
  id: 1,
  file: new File(["x"], "IMG_4823.JPG", { type: "image/jpeg" }),
  previewUrl: "blob:preview-1",
  status: "pending",
  progress: 0,
  ...over,
});

const render = (files: UploadEntry[]) =>
  renderToStaticMarkup(<UploadFileList files={files} onRetry={() => {}} onRemove={() => {}} />);

describe("UploadFileList (BL-078 / SPEC-027 B1, E1, E2)", () => {
  it("B1: shows a thumbnail of each photo, not its file name", () => {
    const html = render([entry({})]);
    expect(html).toMatch(/<img[^>]*src="blob:preview-1"/);
    expect(html).not.toContain("IMG_4823.JPG");
  });

  it("B1: shows waiting, a progress bar while uploading, and uploaded", () => {
    expect(render([entry({ status: "pending" })])).toContain("Waiting");
    const uploading = render([entry({ status: "uploading", progress: 40 })]);
    expect(uploading).toContain("Uploading 40%");
    expect(uploading).toContain('role="progressbar"');
    expect(uploading).toContain("width:40%");
    expect(render([entry({ status: "done" })])).toContain("Uploaded");
  });

  it("A3/E1: a failed upload offers a 44px Retry and removal", () => {
    const html = render([entry({ status: "failed", message: "Check your signal" })]);
    expect(html).toContain("Check your signal");
    expect(html).toMatch(/<button[^>]*min-h-\[44px\][^>]*>Retry<\/button>/);
    expect(html).toContain('aria-label="Remove photo"');
  });

  it("A3: a refused photo shows the server's advice and removal, but no Retry", () => {
    const html = render([entry({ status: "refused", message: "This photo is too blurry." })]);
    expect(html).toContain("This photo is too blurry.");
    expect(html).not.toContain(">Retry<");
    expect(html).toContain('aria-label="Remove photo"');
  });

  it("E1/E2: the remove control is labelled and at least 44px", () => {
    const html = render([entry({ status: "failed" })]);
    expect(html).toMatch(/<button[^>]*aria-label="Remove photo"[^>]*class="[^"]*min-h-\[44px\][^"]*min-w-\[44px\]/);
  });
});
