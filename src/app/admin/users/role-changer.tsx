"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The roles on offer come from the server, which reads the journey switches (BL-080 / SPEC-029 D1).
export function RoleChanger({ userId, currentRole, roles }: { userId: string; currentRole: string; roles: readonly string[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value;
    if (newRole === currentRole) return;
    setLoading(true);

    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    setLoading(false);
    router.refresh(); // re-fetch the server component data
  }

  return (
    <select
      defaultValue={currentRole}
      onChange={handleChange}
      disabled={loading}
      className="border rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
    >
      {roles.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}
