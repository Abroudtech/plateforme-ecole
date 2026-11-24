"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * Rangée d'onglets (liens), défilable sur téléphone.
 * L'onglet ouvert est ramené à l'écran : sur un petit écran, on voit toujours
 * où l'on se trouve, même si l'onglet est loin dans la rangée.
 */
export function Tabs({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = ref.current;
    const current = nav?.querySelector<HTMLElement>("[aria-current=page]");
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return;
    const navBox = nav.getBoundingClientRect();
    const box = current.getBoundingClientRect();
    if (box.left < navBox.left || box.right > navBox.right) {
      nav.scrollBy({ left: box.left - navBox.left - (navBox.width - box.width) / 2 });
    }
  }, [active]);

  return (
    <nav ref={ref} className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm font-medium">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 ${
            item.key === active ? "bg-blue-900 text-white" : "bg-white ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
