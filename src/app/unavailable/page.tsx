import Link from "next/link";

// Launch scope (BL-058): where a roofer or drone account lands while its
// journey is switched off. Middleware sends it here from every signed-in page.
export default function UnavailablePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 text-center">
        <p className="text-2xl font-bold text-blue-700 mb-4">SkyVault</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Not available at the moment</h1>
        <p className="text-gray-500 text-sm mb-6">
          This part of SkyVault is not available at the moment. Your account and its details are kept safe, and
          we&apos;ll be in touch when it opens again.
        </p>
        <Link
          href="/api/auth/signout"
          className="inline-block text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg"
        >
          Sign out
        </Link>
      </div>
    </div>
  );
}
