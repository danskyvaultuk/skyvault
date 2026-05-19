"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("resend", { email, redirect: false, callbackUrl: "/auth/redirect" });

    if (result?.error) {
      setError("Could not send magic link. Please try again.");
    } else {
      setMagicSent(true);
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

            {/* GOOGLE */}
            <div className="mt-4">
              <button
                onClick={() => signIn("google", { callbackUrl: "/auth/redirect" })}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.583c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.167 6.656 3.583 9 3.583z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </div>


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
