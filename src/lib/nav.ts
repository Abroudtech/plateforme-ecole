import type { Role } from "@prisma/client";
import type { NavItem } from "@/components/nav-icons";
import type { Dictionary } from "@/i18n/dictionaries";
import { can } from "@/lib/auth/permissions";

/**
 * Entrées de menu selon les droits de la personne connectée.
 * `all` : menu complet (ordinateur, page « Plus ») ; `bottom` : 4 ou 5 onglets du téléphone.
 */
export function navFor(roles: readonly Role[], lang: string, dict: Dictionary): { all: NavItem[]; bottom: NavItem[] } {
  const h = (path: string) => `/${lang}/${path}`;
  const home: NavItem = { href: h("tableau-de-bord"), label: dict.nav.dashboard, icon: "home" };
  const account: NavItem = { href: h("mon-compte"), label: dict.account.title, icon: "account" };

  const workshop: NavItem = { href: h("atelier"), label: dict.nav.workshop, icon: "workshop" };
  const classSpace: NavItem = { href: h("espace-classe"), label: dict.nav.classSpace, icon: "classSpace" };

  // Enseignant (sans être de la direction) : ses classes, l'appel, l'atelier IA.
  if (can(roles, "teacher.space") && !can(roles, "dashboard.admin")) {
    const classes: NavItem = { href: h("classes"), label: dict.nav.myClasses, icon: "classes" };
    const attendance: NavItem = { href: h("absences"), label: dict.nav.attendance, icon: "attendance" };
    const parent: NavItem[] = can(roles, "children.read")
      ? [
          { href: h("messages"), label: dict.nav.messages, icon: "messages" },
          { href: h("annonces"), label: dict.messages.announcements, icon: "announcements" },
        ]
      : [];
    const all: NavItem[] = [home, classes, attendance, { href: h("eleves"), label: dict.nav.students, icon: "students" }, workshop, classSpace, ...parent, account];
    return { all, bottom: [home, classes, attendance, workshop, { href: h("menu"), label: dict.nav.more, icon: "more" }] };
  }

  // Élève : défis, jeux, classement et mur de la classe.
  if (can(roles, "student.space")) {
    const items: NavItem[] = [
      home,
      { href: h("defis"), label: dict.nav.challenges, icon: "challenges" },
      { href: h("jeux"), label: dict.nav.games, icon: "games" },
      classSpace,
      account,
    ];
    return { all: items, bottom: items };
  }

  if (can(roles, "students.read")) {
    const students: NavItem = { href: h("eleves"), label: dict.nav.students, icon: "students" };
    const classes: NavItem = { href: h("classes"), label: dict.nav.classes, icon: "classes" };
    const attendance: NavItem = { href: h("absences"), label: dict.nav.attendance, icon: "attendance" };
    const payments: NavItem | null = can(roles, "payments.read") ? { href: h("paiements"), label: dict.nav.payments, icon: "payments" } : null;
    const all: NavItem[] = [
      home,
      students,
      classes,
      attendance,
      { href: h("emplois-du-temps"), label: dict.nav.timetables, icon: "timetable" },
      ...(payments ? [payments] : []),
      ...(can(roles, "messages.school") ? [{ href: h("messages"), label: dict.nav.messages, icon: "messages" } as NavItem] : []),
      ...(can(roles, "settings.write") ? [{ href: h("parametres"), label: dict.nav.settings, icon: "settings" } as NavItem] : []),
      account,
    ];
    const bottom: NavItem[] = [home, students, attendance, payments ?? classes, { href: h("menu"), label: dict.nav.more, icon: "more" }];
    return { all, bottom };
  }

  if (can(roles, "children.read")) {
    const items: NavItem[] = [
      home,
      { href: h("messages"), label: dict.nav.messages, icon: "messages" },
      { href: h("annonces"), label: dict.messages.announcements, icon: "announcements" },
      account,
    ];
    return { all: items, bottom: items };
  }

  return { all: [home, account], bottom: [home, account] };
}
