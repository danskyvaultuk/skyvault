import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <span className="text-xl font-bold text-blue-700">SkyVault</span>
        <div className="flex gap-4 items-center">
          <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900">
            Blog
          </Link>
          <Link href="/login" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">
            Sign in
          </Link>
          <Link href="/register" className="text-sm bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800">
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero — homeowners */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 bg-gradient-to-b from-blue-50 to-white">
        <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-4">For homeowners</p>
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 max-w-3xl">
          Know the truth about{" "}
          <span className="text-blue-700">your roof</span>
        </h1>
        <p className="mt-6 text-xl text-gray-600 max-w-2xl">
          Upload a few photos or book a drone capture. Our AI analyses them, produces a professional
          health report, and connects you with verified local roofers — in minutes.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register?role=customer"
            className="bg-blue-700 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-800"
          >
            Start free survey
          </Link>
          <a href="#how-it-works" className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50">
            How it works
          </a>
        </div>
      </section>

      {/* How it works — homeowners */}
      <section id="how-it-works" className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Three steps to a roof report</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { step: "1", title: "Upload or book", desc: "Take photos yourself or book a licensed drone operator for professional aerial imagery." },
              { step: "2", title: "AI analysis", desc: "Our AI detects defects, scores your roof's condition, and generates a full PDF report within minutes." },
              { step: "3", title: "Get quotes", desc: "Your report is shared with up to 3 verified local roofers who can contact you directly." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-blue-700 text-white flex items-center justify-center text-xl font-bold mb-4">
                  {step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Simple pricing for homeowners</h2>
          <p className="text-center text-gray-500 mb-12">Free self-upload surveys. Paid drone capture for professional imagery.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl border p-8">
              <h3 className="text-xl font-bold mb-2">Self Upload</h3>
              <p className="text-4xl font-extrabold mb-1">Free</p>
              <p className="text-gray-500 mb-6">No credit card needed</p>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li>✓ Upload your own photos</li>
                <li>✓ AI roof health report</li>
                <li>✓ PDF download</li>
                <li>✓ Connect with up to 3 roofers</li>
              </ul>
              <Link href="/register?role=customer" className="mt-8 block text-center bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800">
                Get started free
              </Link>
            </div>
            <div className="bg-blue-700 rounded-xl p-8 text-white">
              <h3 className="text-xl font-bold mb-2">Drone Capture</h3>
              <p className="text-4xl font-extrabold mb-1">£89</p>
              <p className="text-blue-200 mb-6">One-time per property</p>
              <ul className="space-y-2 text-sm">
                <li>✓ Licensed drone pilot dispatched</li>
                <li>✓ Professional aerial imagery</li>
                <li>✓ Full AI analysis report</li>
                <li>✓ Results within 48 hours</li>
              </ul>
              <Link href="/register?role=customer" className="mt-8 block text-center bg-white text-blue-700 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-50">
                Book a drone survey
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Roofers section */}
      <section id="roofers" className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-green-600 uppercase tracking-widest mb-3">For roofers</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Stop chasing cold leads. Get qualified jobs delivered to you.
            </h2>
            <p className="text-gray-600 mb-6">
              Every lead comes with a full AI-generated roof report — condition score, defect list,
              and photo evidence. You know exactly what you're quoting before you pick up the phone.
            </p>
            <ul className="space-y-3 text-sm text-gray-700 mb-8">
              <li className="flex items-start gap-2"><span className="text-green-500 font-bold mt-0.5">✓</span> Pre-qualified leads with full report attached</li>
              <li className="flex items-start gap-2"><span className="text-green-500 font-bold mt-0.5">✓</span> Max 3 roofers per lead — no race to the bottom</li>
              <li className="flex items-start gap-2"><span className="text-green-500 font-bold mt-0.5">✓</span> Basic plan: £49/month for up to 10 leads</li>
              <li className="flex items-start gap-2"><span className="text-green-500 font-bold mt-0.5">✓</span> Pro plan: £129/month for unlimited leads</li>
            </ul>
            <Link
              href="/register?role=roofer"
              className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
            >
              Join as a roofer →
            </Link>
          </div>
          <div className="bg-gray-50 rounded-2xl p-8 border">
            <div className="space-y-4">
              {[
                { score: 3, postcode: "SW1A", type: "Residential", claims: "1 / 3 claimed", colour: "text-red-600" },
                { score: 6, postcode: "EC1A", type: "Commercial",  claims: "2 / 3 claimed", colour: "text-amber-500" },
                { score: 8, postcode: "W1B",  type: "Residential", claims: "0 / 3 claimed", colour: "text-green-600" },
              ].map((lead) => (
                <div key={lead.postcode} className="bg-white rounded-xl border px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{lead.postcode} · {lead.type}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{lead.claims}</p>
                  </div>
                  <p className={`text-2xl font-bold ${lead.colour}`}>{lead.score}/10</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">Example lead feed</p>
          </div>
        </div>
      </section>

      {/* Drone operators section */}
      <section id="operators" className="py-20 px-6 bg-blue-700 text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-blue-200 uppercase tracking-widest mb-3">For drone operators</p>
            <h2 className="text-3xl font-bold mb-4">
              Turn your drone licence into a steady income stream.
            </h2>
            <p className="text-blue-100 mb-6">
              Customers book drone surveys through SkyVault. Jobs come to you — just accept, fly,
              upload the images, and get paid. No sales, no marketing, no chasing invoices.
            </p>
            <ul className="space-y-3 text-sm text-blue-100 mb-8">
              <li className="flex items-start gap-2"><span className="text-blue-300 font-bold mt-0.5">✓</span> Jobs matched to your location automatically</li>
              <li className="flex items-start gap-2"><span className="text-blue-300 font-bold mt-0.5">✓</span> Flat £30 payout per completed survey</li>
              <li className="flex items-start gap-2"><span className="text-blue-300 font-bold mt-0.5">✓</span> Upload images directly from the app</li>
              <li className="flex items-start gap-2"><span className="text-blue-300 font-bold mt-0.5">✓</span> Must hold a valid UK CAA drone licence</li>
            </ul>
            <Link
              href="/register?role=drone"
              className="inline-block bg-white text-blue-700 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50"
            >
              Apply as a drone operator →
            </Link>
          </div>
          <div className="bg-blue-800 rounded-2xl p-8 border border-blue-600">
            <div className="space-y-5">
              {[
                { area: "SW London", jobs: "3 jobs available", payout: "£30 each" },
                { area: "Manchester", jobs: "1 job available", payout: "£30 each" },
                { area: "Birmingham", jobs: "2 jobs available", payout: "£30 each" },
              ].map((item) => (
                <div key={item.area} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{item.area}</p>
                    <p className="text-sm text-blue-300">{item.jobs}</p>
                  </div>
                  <span className="bg-blue-600 text-white text-sm font-medium px-3 py-1 rounded-full">{item.payout}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-400 text-center mt-6">Example job board</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white px-6 py-8 text-center text-sm text-gray-500">
        <div className="flex justify-center gap-6 mb-4 text-xs">
          <a href="#roofers" className="hover:text-gray-900">For roofers</a>
          <a href="#operators" className="hover:text-gray-900">For drone operators</a>
          <Link href="/login" className="hover:text-gray-900">Sign in</Link>
        </div>
        <p>© 2026 SkyVault Ltd. All rights reserved.</p>
        <p className="mt-1">AI reports are indicative assessments only and do not replace a physical inspection by a qualified professional.</p>
      </footer>
    </main>
  );
}
