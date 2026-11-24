import { Fragment, type ReactNode } from "react";
import { schoolTitle, type AttLang, type Attestation, type SchoolInfo } from "@/lib/attestations";

type School = SchoolInfo & { phone: string | null };

/** Met en gras les passages demandés (nom de la personne) dans un paragraphe. */
function emphasize(text: string, strong: string[] = []): ReactNode {
  const parts = strong.filter(Boolean);
  if (parts.length === 0) return text;
  const re = new RegExp(`(${parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text.split(re).map((chunk, i) => (parts.includes(chunk) ? <strong key={i}>{chunk}</strong> : <Fragment key={i}>{chunk}</Fragment>));
}

/**
 * Attestation sur une page A4, comme le modèle Word de l'école : en-tête
 * bilingue avec le logo, date, titre encadré, texte, signature et adresse en bas.
 */
export function AttestationDoc({ doc, lang, school, logoUrl, signatureLabel }: { doc: Attestation; lang: AttLang; school: School; logoUrl: string | null; signatureLabel: string }) {
  const footerAr = [school.addressAr, school.cityAr].filter(Boolean).join(" - ");
  const footerFr = [school.address, school.city].filter(Boolean).join(" - ");
  return (
    <article className="attestation mx-auto flex w-full max-w-[210mm] flex-col bg-white px-6 py-6 text-[15px] text-slate-900 shadow-card ring-1 ring-slate-200 print:min-h-[255mm] print:max-w-none print:p-0 print:shadow-none print:ring-0 sm:min-h-[297mm] sm:px-14 sm:py-10">
      <header className="flex items-center gap-3 border-b-2 border-slate-800 pb-2 text-[12px] leading-snug" dir="ltr">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-16 w-16 shrink-0 object-contain" />
        )}
        <div lang="fr" className="min-w-0 flex-1">
          <p>République Tunisienne – Ministère de l&apos;Éducation</p>
          <p className="font-bold">{schoolTitle(school, "fr")}</p>
        </div>
        <div lang="ar" dir="rtl" className="min-w-0 flex-1 text-right">
          <p>الجمهورية التونسية – وزارة التربية</p>
          <p className="font-bold">{schoolTitle(school, "ar")}</p>
        </div>
      </header>

      <div lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="flex flex-1 flex-col">
        <p className="mt-8 text-right">{doc.place}</p>
        <h1 className="mx-auto mt-10 mb-10 rounded-xl border-2 border-slate-800 px-8 py-2 text-center font-serif text-2xl font-bold shadow-[3px_3px_0_#1e293b] sm:text-3xl">
          {doc.title}
        </h1>
        <div className="flex flex-col gap-5 text-justify leading-[2.1]">
          {doc.paragraphs.map((p, i) => (
            <p key={i} className="indent-10">{emphasize(p.text, p.strong)}</p>
          ))}
        </div>
        <div className="mt-12 flex justify-end">
          <div className="min-w-48 text-center">
            <p className="font-bold">{doc.signer}</p>
            {doc.signerName && <p className="mt-1 font-semibold">{doc.signerName}</p>}
            <p className="mt-16 text-xs text-slate-400 print:text-slate-300">{signatureLabel}</p>
          </div>
        </div>
      </div>

      {(footerAr || footerFr || school.phone) && (
        <footer className="mt-10 border-t-4 border-double border-slate-700 pt-1.5 text-center text-[11px] leading-snug">
          {footerAr && <p lang="ar" dir="rtl">{footerAr}</p>}
          {footerFr && <p lang="fr">{footerFr}</p>}
          {school.phone && <p dir="ltr">Tél. / الهاتف : <bdi dir="ltr">{school.phone}</bdi></p>}
        </footer>
      )}
    </article>
  );
}
