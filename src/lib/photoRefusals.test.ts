import { describe, expect, it, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockReportError = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { photoRefusal: { create: (...a: unknown[]) => mockCreate(...a) } } }));
vi.mock("@/lib/monitoring", () => ({ reportError: (...a: unknown[]) => mockReportError(...a) }));

const { recordPhotoRefusal } = await import("./photoRefusals");

beforeEach(() => {
  mockCreate.mockReset().mockResolvedValue({});
  mockReportError.mockReset();
});

describe("recordPhotoRefusal (BL-080 / SPEC-029 C1, C2)", () => {
  it("saves the survey and the reason, and nothing about the photo", async () => {
    await recordPhotoRefusal("survey-1", "blurry");
    expect(mockCreate).toHaveBeenCalledWith({ data: { surveyId: "survey-1", reason: "blurry" } });
  });

  it("never throws when the save fails, and reports it with the survey and reason only", async () => {
    mockCreate.mockRejectedValue(new Error("database down"));
    await expect(recordPhotoRefusal("survey-1", "too-small")).resolves.toBeUndefined();
    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error), { what: "photo-refusal-record", surveyId: "survey-1", reason: "too-small" });
  });
});
