import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DevRoleSwitcher } from "@/components/dev-role-switcher";
import { MobileNav } from "@/components/mobile-nav";

const nav = [
  { href: "/roofer/dashboard", label: "Dashboard" },
  { href: "/roofer/leads", label: "Leads" },
  { href: "/roofer/subscription", label: "Subscription" },
  { href: "/roofer/profile", label: "Profile" },
];

export default async function RooferLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true },
    orderBy: { role: "asc" },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <MobileNav nav={nav} title="SkyVault" subtitle="Roofer Portal" homeHref="/roofer/dashboard" />
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex w-56 bg-white border-r flex-col shrink-0">
          <div className="px-6 py-5 border-b">
            <Link href="/roofer/dashboard" className="text-lg font-bold text-blue-700">SkyVault</Link>
            <p className="text-xs text-gray-500 mt-0.5">Roofer Portal</p>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {nav.map(({ href, label }) => (
              <Link key={href} href={href}
                className="flex items-center px-3 py-2 text-sm rounded-lg text-gray-700 hover:bg-gray-100">
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white border-b px-4 md:px-6 py-3 flex items-center justify-end gap-2 md:gap-4">
            <div className="hidden md:block">
              <DevRoleSwitcher users={users} currentEmail={session.user?.email ?? ""} />
            </div>
            <p className="text-sm text-gray-500 hidden sm:block truncate max-w-[180px]">{session.user?.email}</p>
            <Link href="/api/auth/signout"
              className="text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg whitespace-nowrap">
              Sign out
            </Link>
          </header>
          <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
        </div>
      </div>
    </div>
  );
}
