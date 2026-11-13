import { describe, it, expect, vi } from "vitest";
import { refreshSessionToken } from "./sessionRole";

describe("refreshSessionToken", () => {
  it("replaces the token's role with the database role", async () => {
    const findUser = vi.fn().mockResolvedValue({ role: "customer" });
    const token = await refreshSessionToken({ id: "u1", role: "admin" }, undefined, findUser);
    expect(token?.role).toBe("customer");
    expect(findUser).toHaveBeenCalledWith("u1");
  });

  it("signs out a user who no longer exists", async () => {
    const findUser = vi.fn().mockResolvedValue(null);
    expect(await refreshSessionToken({ id: "gone", role: "admin" }, undefined, findUser)).toBeNull();
  });

  it("takes the id of the user signing in and reads their role", async () => {
    const findUser = vi.fn().mockResolvedValue({ role: "admin" });
    const token = await refreshSessionToken({}, { id: "u2" }, findUser);
    expect(token).toMatchObject({ id: "u2", role: "admin" });
  });

  it("gives no session for a token without a user id", async () => {
    const findUser = vi.fn();
    expect(await refreshSessionToken({}, undefined, findUser)).toBeNull();
    expect(findUser).not.toHaveBeenCalled();
  });
});
