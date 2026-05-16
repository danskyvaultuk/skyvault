"use client";

import { useState } from "react";
import Link from "next/link";

interface NavItem { href: string; label: string; }

interface MobileNavProps {
  nav: NavItem[];
  title: string;
  subtitle?: string;
  homeHref: string;
  variant?: "light" | "dark";
}

export function MobileNav({ nav, title, subtitle, homeHref, variant = "light" }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const dark = variant === "dark";

  return (
    <>
      <div className={`md:hidden flex items-center justify-between px-4 py-3 border-b shrink-0 ${dark ? "bg-gray-900 border-gray-700" : "bg-white"}`}>
        <Link href={homeHref} className={`text-lg font-bold ${dark ? "text-blue-400" : "text-blue-700"}`}>
          {title}
          {subtitle && <span className={`block text-xs font-normal ${dark ? "text-gray-400" : "text-gray-500"}`}>{subtitle}</span>}
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className={`p-2 rounded-lg ${dark ? "text-gray-300 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100"}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 top-0 bottom-0 w-64 flex flex-col ${dark ? "bg-gray-900" : "bg-white"}`}>
            <div className={`px-6 py-5 border-b flex items-center justify-between ${dark ? "border-gray-700" : ""}`}>
              <div>
                <Link href={homeHref} className={`text-lg font-bold ${dark ? "text-blue-400" : "text-blue-700"}`} onClick={() => setOpen(false)}>
                  {title}
                </Link>
                {subtitle && <p className={`text-xs mt-0.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>{subtitle}</p>}
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className={`p-1 rounded ${dark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {nav.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center px-3 py-2 text-sm rounded-lg ${dark ? "text-gray-300 hover:bg-gray-800 hover:text-white" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
