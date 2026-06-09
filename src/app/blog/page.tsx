import Link from "next/link";
import Image from "next/image";
import { blogPosts } from "@/data/blogPosts";

export const metadata = {
  title: "Blog — SkyVault",
  description:
    "Insights, case studies, and technology deep-dives from the SkyVault team.",
};

export default function BlogIndexPage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/" className="text-xl font-bold text-blue-700">
          SkyVault
        </Link>
        <div className="flex gap-4 items-center">
          <Link href="/blog" className="text-sm font-medium text-blue-700">
            Blog
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

      {/* Header */}
      <section className="bg-gradient-to-b from-blue-50 to-white px-6 py-16 text-center">
        <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">
          SkyVault Blog
        </p>
        <h1 className="text-4xl font-extrabold text-gray-900">
          Insights & Case Studies
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-xl mx-auto">
          Technology deep-dives, survey case studies, and updates from the SkyVault team.
        </p>
      </section>

      {/* Post grid */}
      <section className="flex-1 px-6 py-12 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="relative h-48 bg-gray-100">
                <Image
                  src={post.featuredImage}
                  alt={post.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <div className="p-5">
                <div className="flex gap-2 mb-3 flex-wrap">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="text-base font-bold text-gray-900 group-hover:text-blue-700 transition-colors leading-snug mb-2">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-500 line-clamp-2">{post.description}</p>
                <p className="mt-3 text-xs text-gray-400">{post.date}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white px-6 py-8 text-center text-sm text-gray-500">
        <div className="flex justify-center gap-6 mb-4 text-xs">
          <Link href="/" className="hover:text-gray-900">Home</Link>
          <Link href="/login" className="hover:text-gray-900">Sign in</Link>
        </div>
        <p>© 2026 SkyVault Ltd. All rights reserved.</p>
      </footer>
    </main>
  );
}
