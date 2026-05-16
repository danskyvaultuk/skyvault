"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

const ROLE_COLOURS: Record<string, string> = {
  admin:    "bg-purple-100 text-purple-700",
  customer: "bg-blue-100 text-blue-700",
  roofer:   "bg-green-100 text-green-700",
  drone:    "bg-amber-100 text-amber-700",
};

const ROLE_DASHBOARDS: Record<string, string> = {
  admin:    "/admin/dashboard",
  customer: "/dashboard",
  roofer:   "/roofer/dashboard",
  drone:    "/drone/dashboard",
};

export function DevRoleSwitcher({ users, currentEmail }: { users: User[]; currentEmail: string }) {
  const [loading, setLoading] = useState(false);

  async function switchTo(user: User) {
    if (user.email === currentEmail) return;
    setLoading(true);
    await signIn("dev-login", {
      email: user.email,
      redirect: true,
      callbackUrl: ROLE_DASHBOARDS[user.role] ?? "/dashboard",
    });
  }

  return (
    <div className="flex items-center gap-1 border rounded-lg p-1 bg-amber-50 border-amber-200">
      <span className="text-xs text-amber-700 font-medium px-1">Dev:</span>
      {users.map((u) => (
        <button
          key={u.id}
          onClick={() => switchTo(u)}
          disabled={loading || u.email === currentEmail}
          title={u.email}
          className={`text-xs font-medium px-2.5 py-1 rounded-md transition disabled:cursor-default ${
            u.email === currentEmail
              ? `${ROLE_COLOURS[u.role]} opacity-100 ring-2 ring-offset-1 ring-current`
              : `${ROLE_COLOURS[u.role]} opacity-60 hover:opacity-100`
          }`}
        >
          {u.role}
        </button>
      ))}
      {loading && <span className="text-xs text-amber-600 ml-1">switching…</span>}
    </div>
  );
}
