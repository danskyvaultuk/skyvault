import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MobileNav } from "@/components/mobile-nav";
import { journeys } from "@/lib/journeys";
import { SignOutButton } from "@/components/sign-out-button";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/surveys", label: "Surveys" },
  { href: "/properties", label: "Properties" },
  // Launch scope (BL-058): roofer quotes only while the roofer journey is on.
  ...(journeys.rooferEnabled ? [{ href: "/quotes", label: "My Quotes" }] : []),
];

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  // Phones get one header, the menu bar, with the email and Sign out inside the
  // menu; the page scrolls as a whole, with no inner scroll box (BL-078 / SPEC-027 C1, C2).
  return (
    <div className="min-h-screen flex flex-col">
      <MobileNav nav={nav} title="SkyVault" homeHref="/dashboard" account={{ email: session.user?.email ?? "" }} />
      <div className="flex flex-1">
        <aside className="hidden md:flex w-56 bg-white border-r flex-col shrink-0 sticky top-0 h-screen">
          <div className="px-6 py-5 border-b">
            <Link href="/dashboard" className="text-lg font-bold text-blue-700">SkyVault</Link>
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
          <header className="hidden md:flex bg-white border-b px-6 py-3 items-center justify-end gap-4" data-testid="desktop-header">
            <p className="text-sm text-gray-500 truncate max-w-[180px]">{session.user?.email}</p>
            <SignOutButton className="text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg whitespace-nowrap" />
          </header>
          <main className="flex-1 bg-gray-50">{children}</main>
        </div>
      </div>
    </div>
  );
}
