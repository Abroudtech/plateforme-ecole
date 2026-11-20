import type { Locale } from "@/i18n/config";
import { formatMoney } from "@/lib/payments";

/** Montant toujours affiché de gauche à droite, même en arabe. */
export function Money({ value, lang, className = "" }: { value: number; lang: Locale; className?: string }) {
  return (
    <bdi dir="ltr" className={`whitespace-nowrap tabular-nums ${className}`}>
      {formatMoney(value, lang)}
    </bdi>
  );
}
