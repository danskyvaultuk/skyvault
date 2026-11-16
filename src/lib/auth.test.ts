// The session callbacks of the real auth configuration read the role from the
// database (BL-066 / SPEC-021 B1). NextAuth is replaced by a stub that keeps the
// configuration auth.ts hands it, so its callbacks can be driven directly.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUserFindUnique = vi.fn();
type Hooks = Record<string, (args: unknown) => unknown>;
const captured: { config?: { callbacks: Hooks; events?: Hooks } } = {};
const mockAlertNewUser = vi.fn();
vi.mock("@/lib/adminAlerts", () => ({ alertNewUser: (...a: unknown[]) => mockAlertNewUser(...a) }));

vi.mock("next-auth", () => ({
  default: (config: { callbacks: Hooks; events?: Hooks }) => {
    captured.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("next-auth/providers/google", () => ({ default: () => ({ id: "google" }) }));
vi.mock("next-auth/providers/resend", () => ({ default: () => ({ id: "resend" }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) } },
}));

await import("./auth");

function callbacks() {
  if (!captured.config) throw new Error("auth.ts did not configure NextAuth");
  return captured.config.callbacks;
}

beforeEach(() => {
  mockUserFindUnique.mockReset();
});

describe("auth.ts session callbacks", () => {
  it("give the database role when the token holds a different one", async () => {
    mockUserFindUnique.mockResolvedValue({ role: "customer" });
    const token = await callbacks().jwt({ token: { id: "u1", role: "admin" } });
    expect(token).toMatchObject({ id: "u1", role: "customer" });
    expect(mockUserFindUnique.mock.calls[0][0].where).toEqual({ id: "u1" });

    const session = (await callbacks().session({ session: { user: {} }, token })) as { user: { role: string } };
    expect(session.user.role).toBe("customer");
  });

  it("give no session for a user who is not in the database", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    expect(await callbacks().jwt({ token: { id: "gone", role: "admin" } })).toBeNull();
  });
});

describe("auth.ts account creation (BL-084 / SPEC-032 A1, A2)", () => {
  it("A1: a new account sends the new user alert with its id, name, email and role", async () => {
    mockAlertNewUser.mockReset().mockResolvedValue(undefined);
    const createUser = captured.config?.events?.createUser;
    expect(createUser).toBeTypeOf("function");
    await createUser!({ user: { id: "u9", name: null, email: "sam@example.com", role: "customer" } });
    expect(mockAlertNewUser).toHaveBeenCalledWith({ id: "u9", name: null, email: "sam@example.com", role: "customer" });
  });

  it("A2: signing in to an existing account sends nothing: only createUser alerts", () => {
    const events = Object.keys(captured.config?.events ?? {});
    expect(events).toEqual(["createUser"]);
  });
});
