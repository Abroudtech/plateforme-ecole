/**
 * Sépare un document de l'atelier en deux : la partie pour l'élève et le
 * corrigé (section « Corrigé », « Barème », « الإصلاح »...). Sert à imprimer
 * un sujet sans les réponses.
 */
const KEY_HEADING = /^#{1,4}\s.*(corrig|bar[èe]me|solution|answer key|correction|الإصلاح|الإجابة|الحل|سلم التنقيط)/i;

export function splitAnswerKey(markdown: string): { student: string; key: string | null } {
  const lines = markdown.split("\n");
  const at = lines.findIndex((l) => KEY_HEADING.test(l.trim()));
  if (at <= 0) return { student: markdown, key: null };
  // On retire aussi une ligne de séparation (---) juste avant le corrigé.
  let end = at;
  while (end > 0 && /^\s*(-{3,}|\*{3,})?\s*$/.test(lines[end - 1])) end--;
  return { student: lines.slice(0, end).join("\n").trimEnd(), key: lines.slice(at).join("\n").trim() };
}
