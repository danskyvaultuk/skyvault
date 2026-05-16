"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const ROLES = [
  {
    id: "customer",
    label: "Homeowner",
    description: "Get a roof survey and connect with local roofers",
    icon: "🏠",
  },
  {
    id: "roofer",
    label: "Roofer",
    description: "Receive qualified leads with full roof reports attached",
    icon: "🔨",
  },
  {
    id: "drone",
    label: "Drone Operator",
    description: "Accept drone capture jobs and get paid per survey",
    icon: "🚁",
  },
] as const;

type Role = (typeof ROLES)[number]["id"];

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRole = (searchParams.get("role") as Role) ?? "customer";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(preselectedRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const r = searchParams.get("role") as Role;
    if (r && ["customer", "roofer", "drone"].includes(r)) setRole(r);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Create the account
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, role }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // Log them straight in using the dev-login provider
    const result = await signIn("dev-login", { email, redirect: false });

    if (result?.error) {
      setError("Account created but sign-in failed. Try signing in manually.");
      setLoading(false);
      return;
    }

    // Redirect to the right portal
    if (role === "roofer") router.push("/roofer/dashboard");
    else if (role === "drone") router.push("/drone/dashboard");
    else router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-blue-700">SkyVault</Link>
          <p className="mt-2 text-gray-600">Create your account</p>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 hover:underline mt-1 inline-block">
            ← Back to home
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Role picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">I am a…</label>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition ${
                    role === r.id
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-2xl">{r.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{r.label}</p>
                    <p className="text-xs text-gray-500">{r.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Jane Smith"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="jane@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {(role === "roofer" || role === "drone") && (
            <p className="text-xs text-gray-500 bg-gray-50 border rounded-lg px-3 py-2">
              {role === "roofer"
                ? "You'll have immediate access to the roofer portal. An admin will verify your account before your profile badge is activated."
                : "You'll have immediate access to available jobs. An admin will verify your licence before jobs are assigned to you."}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
