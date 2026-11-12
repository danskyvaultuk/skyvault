import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminViewBar } from "./admin-view-bar";

describe("AdminViewBar (BL-070)", () => {
  it("says this is the customer's view and links back to the review page and to all surveys", () => {
    const html = renderToStaticMarkup(<AdminViewBar reportId="report-1" held={false} />);
    expect(html).toContain("this is what the customer sees");
    expect(html).toContain('href="/admin/reports/report-1"');
    expect(html).toContain('href="/admin/surveys"');
  });

  it("keeps saying a held report cannot be seen by the customer yet", () => {
    const html = renderToStaticMarkup(<AdminViewBar reportId="report-1" held={true} />);
    expect(html).toContain("the customer cannot see this report yet");
    expect(html).toContain('href="/admin/reports/report-1"');
    expect(html).toContain('href="/admin/surveys"');
  });
});
