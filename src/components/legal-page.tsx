import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { contactEmail, legal, LEGAL_UPDATED } from "@/lib/mobile/legal";
import { BrandMark } from "@/components/brand";

/** Page publique (sans connexion) : politique de confidentialité ou suppression de compte. */
export function LegalPage({ lang, kind }: { lang: Locale; kind: "privacy" | "deletion" }) {
  const t = legal[lang];
  const email = contactEmail();
  const sections = kind === "privacy" ? t.privacy : t.deletion;
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center gap-2.5 text-blue-900">
        <BrandMark size={36} />
        <h1 className="font-display text-2xl font-semibold">{kind === "privacy" ? t.privacyTitle : t.deletionTitle}</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        {t.updated} : {LEGAL_UPDATED}
      </p>
      {sections.map((s) => (
        <section key={s.title} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-blue-900">{s.title}</h2>
          {s.paragraphs.map((p) => (
            <p key={p} className="mb-2 leading-relaxed text-slate-700">{p}</p>
          ))}
        </section>
      ))}
      <p className="mb-8 rounded-xl bg-blue-50 px-4 py-3 text-slate-800">
        {email ? (
          <>
            {t.contactLine(email).split(email)[0]}
            <a href={`mailto:${email}`} className="font-medium text-blue-800 underline">{email}</a>
            {t.contactLine(email).split(email)[1]}
          </>
        ) : (
          t.contactLine(null)
        )}
      </p>
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href={`/${lang}/connexion`} className="text-blue-800 underline">{t.back}</Link>
        <Link href={`/${lang}/${kind === "privacy" ? "suppression-compte" : "confidentialite"}`} className="text-blue-800 underline">
          {kind === "privacy" ? t.deletionLink : t.privacyLink}
        </Link>
      </nav>
    </main>
  );
}
