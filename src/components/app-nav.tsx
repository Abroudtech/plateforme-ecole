"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ICONS } from "./nav-icons";

export type { NavItem } from "./nav-icons";
import type { NavItem } from "./nav-icons";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Menu horizontal de l'en-tête (ordinateur et tablette). */
export function TopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="mx-auto hidden max-w-6xl flex-wrap gap-1 px-4 pb-3 text-sm font-medium md:flex">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = NAV_ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 transition ${
              active ? "bg-gold-500 text-blue-900" : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={16} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barre d'onglets en bas de l'écran, comme une application (téléphone). */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
      <ul className="mx-auto flex max-w-lg justify-around">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = NAV_ICONS[item.icon];
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 pt-2 pb-2.5 text-[11px] ${active ? "font-bold text-blue-900" : "font-medium text-slate-500"}`}
              >
                <span className={`grid h-7 w-12 place-items-center rounded-full ${active ? "bg-gold-100" : ""}`}>
                  <Icon size={21} strokeWidth={active ? 2.3 : 1.9} aria-hidden />
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
