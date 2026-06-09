import Link from "next/link";
import Image from "next/image";
import { blogPosts } from "@/data/blogPosts";
import { notFound } from "next/navigation";
import ModelViewerWrapper from "@/components/ModelViewerWrapper";

export const metadata = {
  title: "Inside a SkyVault Pro Survey — Interactive 3D Roof Model",
  description:
    "See how drone capture and OpenDroneMap photogrammetry produces a fully interactive 3D model of any property roof.",
};

export default function BlogPost3DDemo() {
  const post = blogPosts.find((p) => p.slug === "3d-roof-survey-demo");
  if (!post) notFound();

  return (
    <main className="flex flex-col min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/" className="text-xl font-bold text-blue-700">
          SkyVault
        </Link>
        <div className="flex gap-4 items-center">
          <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900">
            ← Blog
          </Link>
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800"
          >
            Get started
          </Link>
        </div>
      </nav>

      <article className="max-w-4xl mx-auto w-full px-6 pb-24">
        {/* Hero */}
        <header className="py-16 text-center">
          <div className="flex justify-center gap-2 mb-5">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight">
            Inside a SkyVault Pro Survey
            <br />
            <span className="text-blue-700">Interactive 3D Roof Model</span>
          </h1>
          <p className="mt-5 text-xl text-gray-500 max-w-2xl mx-auto">
            See how our drone capture and ODM photogrammetry pipeline produces a
            fully interactive 3D model of any property
          </p>
          <p className="mt-4 text-sm text-gray-400">{post.date}</p>
        </header>

        {/* Orthophoto banner */}
        <div className="relative w-full h-72 rounded-xl overflow-hidden mb-10 border border-gray-100">
          <Image
            src={post.featuredImage}
            alt="Georeferenced orthophoto of a residential property"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 896px) 100vw, 896px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <p className="absolute bottom-4 left-4 text-xs text-white/80">
            Georeferenced orthophoto — generated from 63 drone images
          </p>
        </div>

        {/* Intro */}
        <section className="prose prose-gray max-w-none mb-12">
          <p className="text-lg text-gray-700 leading-relaxed">
            A SkyVault Pro Survey goes far beyond a standard image upload. A licensed
            drone operator flies two structured passes over the property — the first
            capturing close-range defect shots, the second a photogrammetry grid that
            feeds directly into OpenDroneMap. The result is a georeferenced orthophoto,
            a digital surface model, and — crucially — a fully interactive 3D model
            of the roof you can rotate, zoom, and inspect from any angle.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mt-4">
            The model below is an early test capture — a single photogrammetry pass
            rather than our full two-pass protocol. You&apos;ll notice some gaps and
            rough edges at the model boundaries; these are a direct result of the
            reduced image coverage. A production Pro Survey with the full capture
            protocol produces a significantly cleaner, more complete mesh. This is
            not a render — it&apos;s built entirely from real drone imagery.
          </p>
        </section>

        {/* 3D Model Viewer */}
        <section className="mb-4">
          <ModelViewerWrapper
            src={post.modelUrl}
            alt="Interactive 3D model of a residential roof survey"
            height="600px"
            rotationAxis="y"
            rotationSpeed={15}
          />
          <p className="mt-3 text-sm text-gray-400 text-center">
            Interactive 3D model — drag to rotate, pinch to zoom. Single-pass test
            capture processed via OpenDroneMap.
          </p>
        </section>

        {/* Survey details */}
        <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Survey Details</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {[
                  ["Capture method", "Licensed drone operator"],
                  ["Total images", "63"],
                  ["Flight altitude", "15–25 m AGL"],
                  ["Capture type", "Single-pass photogrammetry (test)"],
                  ["Processing software", "OpenDroneMap"],
                  ["3D outputs", "Orthophoto, DSM, GLB mesh"],
                  ["Point cloud", "Available (.LAZ)"],
                  ["Location", "UK — residential property"],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="py-2 pr-4 text-gray-500 font-medium">{label}</td>
                    <td className="py-2 text-gray-900">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">The Full Two-Pass Protocol</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              A production Pro Survey uses two structured passes. Pass 1 captures
              30–60 close oblique shots at 5–10 m altitude — the primary input for
              Claude Vision defect analysis. The operator works systematically:
              ridge, front slope, rear slope, gutters, chimney and all flashings.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              Pass 2 is a photogrammetry grid: nadir (straight-down) shots on a
              structured flight path, plus high and low oblique orbits. These 75–110
              images feed OpenDroneMap to produce the orthophoto, digital surface
              model, and textured 3D mesh.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              The model shown here was captured in a single pass — so it gives you
              a good sense of the output, but a full two-pass survey produces
              noticeably sharper geometry and better edge coverage.
            </p>
          </div>
        </section>

        {/* AI Analysis */}
        <section className="mt-16 bg-gray-50 rounded-xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">AI Analysis Results</h2>

          {/* Condition score */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-red-100 border-4 border-red-500 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-extrabold text-red-600">4</span>
            </div>
            <div>
              <p className="font-bold text-gray-900">Condition Score: 4 / 10</p>
              <p className="text-sm text-gray-500">
                Poor — immediate remedial work recommended
              </p>
            </div>
          </div>

          {/* Defects */}
          <div className="space-y-3 mb-6">
            {[
              {
                priority: "High",
                name: "Surface Ponding",
                desc: "Standing water detected in multiple low-lying areas of the flat roof section. Indicative of inadequate falls or blocked drainage outlets.",
                color: "red",
              },
              {
                priority: "Medium",
                name: "Biological Growth",
                desc: "Significant moss and algae coverage across the main pitched section, particularly on north-facing slopes. Accelerating membrane degradation.",
                color: "amber",
              },
              {
                priority: "Medium",
                name: "Surface Streaking",
                desc: "Extensive dark streaking consistent with water tracking and algae spread. Gutters showing signs of overflow staining.",
                color: "amber",
              },
            ].map((defect) => (
              <div
                key={defect.name}
                className={`flex gap-3 p-4 rounded-lg border ${
                  defect.color === "red"
                    ? "bg-red-50 border-red-200"
                    : "bg-amber-50 border-amber-200"
                }`}
              >
                <span
                  className={`text-xs font-bold px-2 py-1 rounded h-fit flex-shrink-0 ${
                    defect.color === "red"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {defect.priority}
                </span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{defect.name}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{defect.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Human review banner */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <span className="text-blue-600 mt-0.5 flex-shrink-0">ℹ️</span>
            <div>
              <p className="font-semibold text-blue-800 text-sm">Human review recommended</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Multiple high-priority findings detected. A qualified roofer should
                inspect in person before any remedial work is commissioned.
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            Full report delivered to homeowner as a branded PDF — includes all
            defect images, priority ratings, recommended actions, and estimated
            remaining service life.
          </p>
        </section>

        {/* How it works */}
        <section className="mt-16">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-10">
            How a Pro Survey Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Drone Capture",
                desc: "A licensed operator flies two structured passes — close-range defect shots and a photogrammetry grid.",
                icon: "🚁",
              },
              {
                step: "2",
                title: "ODM Processing",
                desc: "OpenDroneMap stitches the photogrammetry images into a georeferenced orthophoto, digital surface model, and 3D mesh.",
                icon: "⚙️",
              },
              {
                step: "3",
                title: "AI Analysis + 3D Report",
                desc: "Claude Vision analyses the defect shots. Findings are combined with spatial data into a full interactive report and PDF.",
                icon: "🤖",
              },
            ].map(({ step, title, desc, icon }) => (
              <div
                key={step}
                className="text-center bg-gray-50 rounded-xl p-6 border border-gray-100"
              >
                <div className="text-3xl mb-3">{icon}</div>
                <div className="w-7 h-7 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center mx-auto mb-3">
                  {step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 bg-blue-700 rounded-2xl px-8 py-12 text-center text-white">
          <h2 className="text-2xl font-extrabold mb-3">
            Get your property surveyed
          </h2>
          <p className="text-blue-200 mb-8 max-w-md mx-auto">
            Book a licensed drone operator or upload your own photos. AI analysis
            delivered in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register?role=customer&type=drone"
              className="bg-white text-blue-700 font-semibold px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Book a Drone Survey
            </Link>
            <Link
              href="/register?role=customer"
              className="border border-blue-400 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Upload Your Own Images
            </Link>
          </div>
        </section>
      </article>

      {/* Footer */}
      <footer className="border-t bg-white px-6 py-8 text-center text-sm text-gray-500">
        <div className="flex justify-center gap-6 mb-4 text-xs">
          <Link href="/" className="hover:text-gray-900">Home</Link>
          <Link href="/blog" className="hover:text-gray-900">Blog</Link>
          <Link href="/login" className="hover:text-gray-900">Sign in</Link>
        </div>
        <p>© 2026 SkyVault Ltd. All rights reserved.</p>
        <p className="mt-1 text-xs">
          AI reports are indicative assessments only and do not replace a physical
          inspection by a qualified professional.
        </p>
      </footer>
    </main>
  );
}
