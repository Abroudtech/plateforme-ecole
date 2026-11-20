import Link from "next/link";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Forbidden({ params }: PageProps<"/[lang]/acces-refuse">) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-lg font-semibold">{dict.errors.forbidden}</p>
      <Link href={`/${lang}`} className="text-blue-700 underline">{dict.errors.backHome}</Link>
    </main>
  );
}
