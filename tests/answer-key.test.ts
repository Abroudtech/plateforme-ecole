import { describe, expect, it } from "vitest";
import { splitAnswerKey } from "@/lib/ai/answer-key";

describe("version élève d'un document", () => {
  it("retire le corrigé", () => {
    const doc = "# Examen\n\nExercice 1 : 2 + 2 = ....\n\n---\n\n## Corrigé et barème\n\n1. 4 (2 points)";
    const r = splitAnswerKey(doc);
    expect(r.student).toBe("# Examen\n\nExercice 1 : 2 + 2 = ....");
    expect(r.key).toBe("## Corrigé et barème\n\n1. 4 (2 points)");
  });

  it("reconnaît le corrigé en arabe", () => {
    const r = splitAnswerKey("# فرض\n\nالتمرين 1\n\n## الإصلاح\n\nالجواب");
    expect(r.key).toBe("## الإصلاح\n\nالجواب");
  });

  it("garde tout quand il n'y a pas de corrigé", () => {
    expect(splitAnswerKey("# Fiche\n\nTexte")).toEqual({ student: "# Fiche\n\nTexte", key: null });
  });
});
