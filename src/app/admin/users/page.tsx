import { prisma } from "@/lib/prisma";
import { RoleChanger } from "./role-changer";

const ROLE_COLOURS: Record<string, string> = {
  admin:    "bg-purple-100 text-purple-700",
  customer: "bg-blue-100 text-blue-700",
  roofer:   "bg-green-100 text-green-700",
  drone:    "bg-amber-100 text-amber-700",
};

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { properties: true, surveys: true } },
    },
  });

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">All Users</h1>

      <div className="bg-white border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-600">User</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Properties</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Surveys</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Joined</th>
              <th className="px-5 py-3 font-medium text-gray-600">Change role</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{u.name ?? "—"}</p>
                  <p className="text-gray-400 text-xs">{u.email}</p>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLOURS[u.role] ?? ""}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-600">{u._count.properties}</td>
                <td className="px-5 py-3 text-gray-600">{u._count.surveys}</td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {new Date(u.createdAt).toLocaleDateString("en-GB")}
                </td>
                <td className="px-5 py-3">
                  <RoleChanger userId={u.id} currentRole={u.role} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
