export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-gray-600 text-sm">
          We sent you a magic link. Click it to sign in — no password needed.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          Didn&apos;t receive it? Check your spam folder or go back and try again.
        </p>
      </div>
    </div>
  );
}
