import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

// Storage is stood in for; the resize runs on the real sharp (BL-064 / SPEC-028 B2).
vi.mock("@/lib/r2", () => ({ getPresignedReadUrl: async (key: string) => `https://bucket.example/${key}` }));

const { fetchSurveyPhotos } = await import("./surveyImages");

async function photo(width: number, height: number, format: "png" | "jpeg"): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 120, g: 80, b: 40 } } });
  return format === "png" ? image.png().toBuffer() : image.jpeg().toBuffer();
}

function storageReturns(buffer: Buffer) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(buffer), { status: 200 })));
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchSurveyPhotos resizing on the upgraded sharp (BL-064 / SPEC-028 B2)", () => {
  it("shrinks a large photo to fit within 1568px and returns it as JPEG", async () => {
    storageReturns(await photo(4000, 3000, "png"));
    const [prepared] = await fetchSurveyPhotos([{ s3Key: "surveys/s/images/a.png", originalFilename: "a.png" }]);
    expect(prepared.mimeType).toBe("image/jpeg");
    const meta = await sharp(Buffer.from(prepared.base64, "base64")).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1568);
    expect(meta.height).toBe(1176);
  });

  it("leaves a small photo's size alone", async () => {
    storageReturns(await photo(800, 600, "jpeg"));
    const [prepared] = await fetchSurveyPhotos([{ s3Key: "surveys/s/images/b.jpg", originalFilename: "b.jpg" }]);
    const meta = await sharp(Buffer.from(prepared.base64, "base64")).metadata();
    expect([meta.width, meta.height]).toEqual([800, 600]);
  });
});
