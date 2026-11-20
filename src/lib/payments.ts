/**
 * Calculs des paiements (sans base de données, donc faciles à tester).
 * Tous les montants sont en millimes : 1 DT = 1000 millimes.
 */

/** Lit un montant saisi en dinars ("1250", "1 250,500", "1250.5") → millimes, ou null. */
export function parseAmount(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = input.replace(/[\s  ]/g, "").replace(/(dt|tnd|د\.ت)$/i, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,3})?$/.test(s)) return null;
  const [int, dec = ""] = s.split(".");
  return Number(int) * 1000 + Number(dec.padEnd(3, "0"));
}

/** Affiche un montant : 1250500 → "1 250,500 DT" (fr) ou "1250.500 د.ت" (ar). */
export function formatMoney(millimes: number, lang: "fr" | "ar"): string {
  const sign = millimes < 0 ? "-" : "";
  const abs = Math.abs(millimes);
  const dinars = Math.floor(abs / 1000);
  const ms = String(abs % 1000).padStart(3, "0");
  if (lang === "ar") return `${sign}${dinars}.${ms} د.ت`;
  const grouped = String(dinars).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped},${ms} DT`;
}

/** Valeur pour un champ de saisie (en dinars, sans unité). */
export function amountInputValue(millimes: number): string {
  const d = Math.floor(millimes / 1000);
  const ms = millimes % 1000;
  return ms === 0 ? String(d) : `${d}.${String(ms).padStart(3, "0").replace(/0+$/, "")}`;
}

export type Charge = { id: string; amount: number; dueDate: string };
export type ChargeStatus = "paid" | "partial" | "overdue" | "upcoming";
export type ChargeLine = Charge & { paid: number; remaining: number; status: ChargeStatus };

export type Account = {
  lines: ChargeLine[];
  totalDue: number;
  totalPaid: number;
  /** Ce qui reste à payer sur l'année. */
  balance: number;
  /** Ce qui est en retard (échéance passée) à la date du jour. */
  overdue: number;
  /** Paiement en trop (avance), à reporter. */
  credit: number;
};

/**
 * Répartit les paiements sur les frais, du plus ancien au plus récent
 * (échéance la plus proche d'abord), puis calcule ce qui est en retard.
 */
export function computeAccount(charges: Charge[], paidTotal: number, today: string): Account {
  const sorted = [...charges].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
  let left = paidTotal;
  const lines = sorted.map((c) => {
    const paid = Math.min(Math.max(left, 0), c.amount);
    left -= paid;
    const remaining = c.amount - paid;
    const status: ChargeStatus =
      remaining === 0 ? "paid" : c.dueDate < today ? "overdue" : paid > 0 ? "partial" : "upcoming";
    return { ...c, paid, remaining, status };
  });
  const totalDue = charges.reduce((s, c) => s + c.amount, 0);
  return {
    lines,
    totalDue,
    totalPaid: paidTotal,
    balance: Math.max(totalDue - paidTotal, 0),
    overdue: lines.filter((l) => l.status === "overdue").reduce((s, l) => s + l.remaining, 0),
    credit: Math.max(paidTotal - totalDue, 0),
  };
}

/** Lien WhatsApp avec un message prérempli (le numéro au format international, sans +). */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
