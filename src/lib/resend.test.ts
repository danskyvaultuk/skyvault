import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockReportError = vi.fn();
vi.mock("@/lib/monitoring", () => ({ reportError: (...args: unknown[]) => mockReportError(...args) }));

// The sender reads its settings when the module loads, so set them first.
vi.stubEnv("RESEND_API_KEY", "test-key");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");
const { notifyCustomerReportReady, MAX_REPORT_ATTACHMENT_BYTES } = await import("./resend");

type SentBody = { to: string; html: string; attachments?: { filename: string; content: string }[] };

const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

function sentBody(): SentBody {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse(init.body as string) as SentBody;
}

const BASE = { customerEmail: "jane@example.com", customerName: "Jane", surveyId: "survey-1", postcode: "SW1A 1AA" };

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("notifyCustomerReportReady — the PDF attachment (BL-022)", () => {
  it("attaches the PDF under the property's file name and says so, keeping the report link", async () => {
    const pdf = Buffer.from("%PDF-1.4 sample");
    await notifyCustomerReportReady({ ...BASE, pdf });

    const body = sentBody();
    expect(body.attachments).toEqual([
      { filename: "SkyVault-roof-report-SW1A1AA.pdf", content: pdf.toString("base64") },
    ]);
    expect(body.html).toMatch(/attached/i);
    expect(body.html).toContain("https://app.example/surveys/survey-1/report");
  });

  it("sends the link alone, without mentioning an attachment, when there is no PDF", async () => {
    await notifyCustomerReportReady({ ...BASE, pdf: null });

    const body = sentBody();
    expect(body.attachments).toBeUndefined();
    expect(body.html).not.toMatch(/attached/i);
    expect(body.html).toContain("https://app.example/surveys/survey-1/report");
  });

  it("does not attach a PDF over the size limit, logs its size, and still sends the link", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const tooBig = Buffer.alloc(MAX_REPORT_ATTACHMENT_BYTES + 1);

    await notifyCustomerReportReady({ ...BASE, pdf: tooBig });

    const body = sentBody();
    expect(body.attachments).toBeUndefined();
    expect(body.html).not.toMatch(/attached/i);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(String(tooBig.length)));
  });

  it("sets the limit inside the provider's 40 MB per email after Base64 encoding", () => {
    expect(Math.ceil((MAX_REPORT_ATTACHMENT_BYTES * 4) / 3)).toBeLessThan(40 * 1024 * 1024);
  });
});

describe("sendEmail — a failed send is reported without the recipient (SPEC-020 B3)", () => {
  it("reports the subject and status to monitoring, never the address, even when the provider quotes it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockReportError.mockClear();
    fetchMock.mockResolvedValueOnce(new Response('{"message":"Invalid `to` field: jane@example.com"}', { status: 422 }));

    await notifyCustomerReportReady({ ...BASE, pdf: null });

    expect(mockReportError).toHaveBeenCalledTimes(1);
    const [error, context] = mockReportError.mock.calls[0] as [Error, Record<string, unknown>];
    expect(context).toEqual({ what: "email-failed", subject: "Your roof survey report is ready — SkyVault" });
    expect(error.message).toContain("422");
    expect(JSON.stringify([error.message, context])).not.toContain("jane@example.com");
  });
});

describe("notifyCustomerReportReady — the report disclaimer (BL-057 / SPEC-024 C1)", () => {
  it("carries the report disclaimer and a link to the Terms", async () => {
    const { REPORT_DISCLAIMER } = await import("@/content/legal/disclaimer");
    await notifyCustomerReportReady({ ...BASE, pdf: null });
    const { html } = sentBody();
    expect(html).toContain(REPORT_DISCLAIMER);
    expect(html).toContain('href="https://app.example/terms"');
  });
});
