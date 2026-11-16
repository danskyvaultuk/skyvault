import { describe, expect, it, vi, beforeEach } from "vitest";

const mockNewUser = vi.fn();
const mockWaiting = vi.fn();
const mockReportError = vi.fn();
vi.mock("@/lib/resend", () => ({
  notifyAdminNewUser: (...a: unknown[]) => mockNewUser(...a),
  notifyAdminReportWaiting: (...a: unknown[]) => mockWaiting(...a),
}));
vi.mock("@/lib/monitoring", () => ({ reportError: (...a: unknown[]) => mockReportError(...a) }));

const { alertEnabled, alertNewUser, alertReportWaiting } = await import("./adminAlerts");

const USER = { id: "u1", name: "Jane", email: "jane@example.com", role: "customer" };
const REPORT = { reportId: "rep-1", address: "12 High Street", postcode: "TQ9 5QH", customer: "Jane", conditionScore: 6, urgent: true };

beforeEach(() => {
  mockNewUser.mockReset().mockResolvedValue(undefined);
  mockWaiting.mockReset().mockResolvedValue(undefined);
  mockReportError.mockReset();
});

describe("alertEnabled (BL-084 / SPEC-032 C1)", () => {
  it("is off only for off, in any case or spacing", () => {
    for (const off of ["off", "OFF", " Off "]) expect(alertEnabled(off)).toBe(false);
    for (const on of [undefined, "", "on", "yes", "0"]) expect(alertEnabled(on)).toBe(true);
  });
});

describe("alertNewUser (BL-084 / SPEC-032 A1, C1–C3)", () => {
  it("C3: emails the admin address, the configured one or the default", async () => {
    await alertNewUser(USER, {});
    expect(mockNewUser).toHaveBeenCalledWith({ to: "dan@skyvaultuk.com", name: "Jane", email: "jane@example.com", role: "customer" });
    await alertNewUser(USER, { SKYVAULT_ADMIN_EMAIL: "ops@skyvaultuk.com" });
    expect(mockNewUser.mock.calls[1][0].to).toBe("ops@skyvaultuk.com");
  });

  it("C1: its own setting off stops it; the other setting does not", async () => {
    await alertNewUser(USER, { SKYVAULT_ALERT_NEW_USER: "off" });
    expect(mockNewUser).not.toHaveBeenCalled();
    await alertNewUser(USER, { SKYVAULT_ALERT_REPORT_WAITING: "off" });
    expect(mockNewUser).toHaveBeenCalledTimes(1);
  });

  it("C2: a failing send does not throw, and is reported with the user id only", async () => {
    mockNewUser.mockRejectedValue(new Error("network"));
    await expect(alertNewUser(USER, {})).resolves.toBeUndefined();
    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error), { what: "admin-alert-failed", alert: "new-user", userId: "u1" });
    expect(JSON.stringify(mockReportError.mock.calls[0][1])).not.toMatch(/jane|Jane/);
  });
});

describe("alertReportWaiting (BL-084 / SPEC-032 B1, C1–C3)", () => {
  it("C3: emails the admin address with the report's details", async () => {
    await alertReportWaiting(REPORT, {});
    expect(mockWaiting).toHaveBeenCalledWith({ to: "dan@skyvaultuk.com", ...REPORT });
  });

  it("C1: its own setting off stops it; the other setting does not", async () => {
    await alertReportWaiting(REPORT, { SKYVAULT_ALERT_REPORT_WAITING: " OFF" });
    expect(mockWaiting).not.toHaveBeenCalled();
    await alertReportWaiting(REPORT, { SKYVAULT_ALERT_NEW_USER: "off" });
    expect(mockWaiting).toHaveBeenCalledTimes(1);
  });

  it("C2: a failing send does not throw, and is reported with the report id only", async () => {
    mockWaiting.mockRejectedValue(new Error("network"));
    await expect(alertReportWaiting(REPORT, {})).resolves.toBeUndefined();
    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error), { what: "admin-alert-failed", alert: "report-waiting", reportId: "rep-1" });
    expect(JSON.stringify(mockReportError.mock.calls[0][1])).not.toMatch(/High Street|Jane/);
  });
});
