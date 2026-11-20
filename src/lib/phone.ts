/**
 * Met un numéro de téléphone au format international (+216XXXXXXXX pour la
 * Tunisie), pour qu'un parent puisse taper "22 123 456" ou "+216 22123456"
 * et être reconnu de la même façon.
 */
export function normalizePhone(input: string): string | null {
  const cleaned = input.replace(/[\s.\-()]/g, "");
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned;
  if (/^00\d{8,15}$/.test(cleaned)) return `+${cleaned.slice(2)}`;
  if (/^\d{8}$/.test(cleaned)) return `+216${cleaned}`;
  return null;
}
