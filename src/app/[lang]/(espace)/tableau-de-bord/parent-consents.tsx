import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { AppContext } from "@/lib/auth/context";
import { consentClosed, consentsForParent } from "@/lib/data/consents";
import { todayISO } from "@/lib/dates";
import { ConsentCard } from "@/components/consent-card";

type Props = { ctx: AppContext & { school: NonNullable<AppContext["school"]> }; lang: Locale; dict: Dictionary };

/** Accueil du parent : les autorisations à signer, en premier, avec Oui / Non. */
export async function ParentConsents({ ctx, lang, dict }: Props) {
  const rows = await consentsForParent(ctx.school.id, ctx.user.id);
  const today = todayISO();
  const open = rows.filter((r) => !r.reply && !consentClosed(r.request.deadline, today));
  if (open.length === 0) return null;
  const multiChild = (rows[0]?.childCount ?? 0) > 1;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-blue-900">✍️ {dict.consents.toAnswer} ({open.length})</h2>
        <Link href={`/${lang}/autorisations`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-800">
          {dict.consents.title} <ChevronRight size={15} className="rtl:rotate-180" aria-hidden />
        </Link>
      </div>
      {open.slice(0, 3).map((r) => (
        <ConsentCard key={`${r.request.id}-${r.student.id}`} row={r} lang={lang} dict={dict} closed={false} multiChild={multiChild} />
      ))}
    </section>
  );
}
