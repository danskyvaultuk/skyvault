// Keeps a signed-in user's role in step with the database (BL-066 / SPEC-021 B1).
// The session token is refreshed on every server-side session check: the role
// is read from the database each time, so a role change applies to the next
// request, and a user who no longer exists is signed out.
import type { Role } from "@prisma/client";

export type SessionToken = { id?: unknown; role?: unknown; [key: string]: unknown };
type StoredUser = { role: Role } | null;
export type FindUser = (id: string) => Promise<StoredUser>;

export async function refreshSessionToken<T extends SessionToken>(
  token: T,
  signingInUser: { id?: string } | undefined,
  findUser: FindUser
): Promise<T | null> {
  if (signingInUser?.id) token.id = signingInUser.id;
  if (typeof token.id !== "string") return null;

  const stored = await findUser(token.id);
  if (!stored) return null;
  token.role = stored.role;
  return token;
}
