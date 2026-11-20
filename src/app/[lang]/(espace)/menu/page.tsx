import Link from "next/link";
import { ChevronRight, FileSpreadsheet, LogOut, School } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { navFor } from "@/lib/nav";
import { logout } from "@/app/actions/session";
import { NAV_ICONS } from "@/components/nav-icons";
import { PageHeader } from "@/components/ui";

/** Page « Plus » du téléphone : toutes les rubriques en grandes cases. */
export default async function MenuPage({ params }: PageProps<"/[lang]/menu">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);
  const items = navFor(ctx.roles, lang, dict).all.filter((i) => !i.href.endsWith("/tableau-de-bord"));
  const extra = [
    ...(can(ctx.roles, "staff.write") ? [{ href: `/${lang}/enseignants`, label: dict.nav.teachers, Icon: NAV_ICONS.teachers }, { href: `/${lang}/salles`, label: dict.rooms.title, Icon: School }] : []),
    ...(can(ctx.roles, "announcements.write") ? [{ href: `/${lang}/annonces`, label: dict.messages.announcements, Icon: NAV_ICONS.announcements }] : []),
    ...(can(ctx.roles, "dashboard.admin")
      ? [
          { href: `/${lang}/atelier`, label: dict.nav.workshop, Icon: NAV_ICONS.workshop },
          { href: `/${lang}/espace-classe`, label: dict.nav.classSpace, Icon: NAV_ICONS.classSpace },
        ]
      : []),
    ...(can(ctx.roles, "import.write") ? [{ href: `/${lang}/importer`, label: dict.importer.title, Icon: FileSpreadsheet }] : []),
  ];
  const tiles = [...items.map((i) => ({ href: i.href, label: i.label, Icon: NAV_ICONS[i.icon] })), ...extra];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={dict.nav.menu} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link href={href} className="flex h-full items-center gap-3 rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-slate-200/80 hover:ring-gold-400">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-900">
                <Icon size={20} aria-hidden />
              </span>
              <span className="min-w-0 text-sm font-semibold leading-tight">{label}</span>
              <ChevronRight size={16} className="ms-auto shrink-0 text-slate-400 rtl:rotate-180" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <form action={logout.bind(null, lang)}>
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white p-3.5 text-sm font-semibold text-red-700 ring-1 ring-slate-200">
          <LogOut size={18} className="rtl:rotate-180" aria-hidden /> {dict.nav.logout}
        </button>
      </form>
    </div>
  );
}
