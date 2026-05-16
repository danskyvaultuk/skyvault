"use client";

import { signIn, getSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // signIn() returns an object — it does NOT redirect automatically
    const result = await signIn("dev-login", {
      email,
      redirect: false,   // we handle the redirect ourselves so we can catch errors
    });

    if (result?.error) {
      setError("No account found for that email. Add yourself in Prisma Studio first.");
    } else {
      // Fetch the session to read the role, then redirect to the right portal
      const session = await getSession();
      const role = session?.user?.role;
      if (role === "drone")   router.push("/drone/dashboard");
      else if (role === "roofer") router.push("/roofer/dashboard");
      else if (role === "admin")  router.push("/admin/dashboard");
      else                        router.push("/dashboard"); // customer
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

        {/* DEV LOGIN BANNER */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-xs text-amber-800">
          <strong>Dev mode</strong> — type the email you added in Prisma Studio. No password needed.
        </div>

        {/* DEV SIGN-IN FORM */}
        <form onSubmit={handleDevLogin} className="space-y-4">
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
              placeholder="you@example.com"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

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

      </div>
    </div>
  );
}
