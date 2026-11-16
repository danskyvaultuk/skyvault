import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

const switches = { droneEnabled: false, rooferEnabled: false };
vi.mock("@/lib/journeys", () => ({ journeys: switches }));
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => mockRedirect(url) }));
vi.mock("./register-form", () => ({ RegisterForm: () => null }));

const { default: RegisterPage } = await import("./page");
const open = (role?: string) => RegisterPage({ searchParams: Promise.resolve(role === undefined ? {} : { role }) });

beforeEach(() => {
  switches.droneEnabled = false;
  switches.rooferEnabled = false;
  mockRedirect.mockClear();
});

describe("/register (BL-081 / SPEC-030 A3)", () => {
  it.each([[undefined], ["customer"], ["roofer"], ["drone"]])("sends role %s to /login while the journeys are off", async (role) => {
    await expect(open(role)).rejects.toThrow("redirect:/login");
  });

  it("shows the sign-up form for a role whose journey is on", async () => {
    switches.rooferEnabled = true;
    const page = (await open("roofer")) as ReactElement;
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(page).toBeTruthy();
    await expect(open("customer")).rejects.toThrow("redirect:/login");
  });
});
