import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const mockSignOut = vi.fn();
vi.mock("next-auth/react", () => ({ signOut: (...args: unknown[]) => mockSignOut(...args) }));

const { SignOutButton, SIGN_OUT_DESTINATION } = await import("./sign-out-button");

describe("SignOutButton (BL-078 / SPEC-027 F1)", () => {
  it("is a button, not a link to the confirmation page", () => {
    const html = renderToStaticMarkup(<SignOutButton />);
    expect(html).toMatch(/^<button type="button"[^>]*>Sign out<\/button>$/);
    expect(html).not.toContain("/api/auth/signout");
  });

  it("signs out in one click and lands on the home page", () => {
    const element = SignOutButton({}) as ReactElement<{ onClick: () => void }>;
    element.props.onClick();
    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: SIGN_OUT_DESTINATION });
    expect(SIGN_OUT_DESTINATION).toBe("/");
  });
});
