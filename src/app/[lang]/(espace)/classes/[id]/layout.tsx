import type { Locale } from "@/i18n/config";
import { requireContext } from "@/lib/auth/context";
import { requireClassAccess } from "@/lib/auth/scope";

/** Toutes les pages d'une classe : un enseignant n'ouvre que ses propres classes. */
export default async function ClassLayout({ children, params }: LayoutProps<"/[lang]/classes/[id]">) {
  const { lang, id } = await params;
  const ctx = await requireContext(lang as Locale);
  await requireClassAccess(lang as Locale, ctx, id);
  return children;
}
