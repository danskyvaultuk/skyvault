"use client";

export const dynamic = "force-dynamic";

import { signIn, getSession, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function getDashboard(role?: string): string {
  switch (role) {
    case "roofer": return "/roofer/dashboard";
    case "drone":  return "/drone/dashboard";
    case "admin":  return "/admin/dashboard";
    default:       return "/dashboard";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(getDashboard(session?.user?.role));
    }
  }, [status, session, router]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("resend", { email, redirect: false, callbackUrl: "/dashboard" });

    if (result?.error) {
      setError("Could not send magic link. Please try again.");
    } else {
      setMagicSent(true);
    }

    setLoading(false);
  }

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("dev-login", { email, redirect: false });

    if (result?.error) {
      setError("No account found for that email.");
    } else {
      const session = await getSession();
      const role = session?.user?.role;
      if (role === "drone")       router.push("/drone/dashboard");
      else if (role === "roofer") router.push("/roofer/dashboard");
      else if (role === "admin")  router.push("/admin/dashboard");
      else                        router.push("/dashboard");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-700">SkyVault</h1>
          <p className="mt-2 text-gray-600">Sign in to your account</p>
        </div>

        {magicSent ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-3">📬</p>
            <p className="font-semibold text-gray-900 mb-1">Check your email</p>
            <p className="text-sm text-gray-500">
              We sent a sign-in link to <strong>{email}</strong>. Click the link to log in.
            </p>
            <button
              onClick={() => { setMagicSent(false); setEmail(""); }}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            {/* MAGIC LINK FORM */}
            <form onSubmit={handleMagicLink} className="space-y-4">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@skyvaultuk.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send sign-in link"}
              </button>
            </form>

            {/* DEV LOGIN */}
            <details className="mt-6 pt-6 border-t">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                Dev login
              </summary>
              <form onSubmit={handleDevLogin} className="mt-3 space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="existing@skyvaultuk.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {loading ? "Signing in…" : "Sign in without password"}
                </button>
              </form>
            </details>

            <div className="mt-6 pt-6 border-t text-center">
              <p className="text-sm text-gray-500 mb-3">Don&apos;t have an account?</p>
              <div className="flex flex-col gap-2">
                <Link href="/register?role=customer" className="w-full border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 text-center">
                  🏠 Sign up as a homeowner
                </Link>
                <Link href="/register?role=roofer" className="w-full border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 text-center">
                  🔨 Sign up as a roofer
                </Link>
                <Link href="/register?role=drone" className="w-full border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 text-center">
                  🚁 Sign up as a drone operator
                </Link>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
