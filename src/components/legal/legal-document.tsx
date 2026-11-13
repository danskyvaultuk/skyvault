// Renders a legal document (BL-057 / SPEC-024): its title, who runs SkyVault,
// when it was last updated, then its sections.
import Link from "next/link";
import { LEGAL_LAST_UPDATED, OPERATOR, type LegalSection } from "@/content/legal/operator";

export function LegalDocument({ title, sections }: { title: string; sections: readonly LegalSection[] }) {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/" className="text-sm text-blue-600 hover:underline">← SkyVault</Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-6">{title}</h1>
        <p className="text-sm text-gray-500 mt-2">
          {OPERATOR.description} · Last updated {LEGAL_LAST_UPDATED}
        </p>
        {sections.map((section) => (
          <section key={section.heading} className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{section.heading}</h2>
            {section.paragraphs.map((text) => (
              <p key={text} className="text-sm text-gray-700 leading-relaxed mb-2">{text}</p>
            ))}
            {section.items && (
              <ul className="list-disc pl-5 space-y-1">
                {section.items.map((text) => (
                  <li key={text} className="text-sm text-gray-700 leading-relaxed">{text}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
