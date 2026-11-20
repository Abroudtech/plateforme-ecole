import Link from "next/link";

/** Rangée d'onglets (liens), défilable sur téléphone. */
export function Tabs({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm font-medium">
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
