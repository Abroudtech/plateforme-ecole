/**
 * Jeux éducatifs de l'espace élève. Les questions sont fabriquées ici (sans
 * réseau ni IA) et adaptées au niveau de l'élève : 1 = 1re année ... 6 = 6e.
 * Chaque partie compte 10 questions ; 1 bonne réponse = 1 point.
 */

export const GAME_KEYS = ["calcul", "tables", "lettres", "mots"] as const;
export type GameKey = (typeof GAME_KEYS)[number];
export const QUESTIONS_PER_GAME = 10;
/** Parties qui rapportent des points, par jeu et par jour. */
export const SCORED_GAMES_PER_DAY = 5;

export type Question = {
  /** Texte de la question (opération, mot à compléter...). */
  prompt: string;
  /** Image (émoji) qui accompagne la question. */
  emoji?: string;
  choices: string[];
  answer: number;
  /** Sens d'écriture de la question et des choix. */
  dir: "rtl" | "ltr";
};

export function isGameKey(v: string): v is GameKey {
  return (GAME_KEYS as readonly string[]).includes(v);
}

type Rng = () => number;

const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

function shuffle<T>(rng: Rng, list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Bonne réponse + deux ou trois réponses proches et différentes. */
function numberChoices(rng: Rng, answer: number, count = 4): { choices: string[]; answer: number } {
  const set = new Set<number>([answer]);
  const spread = Math.max(3, Math.round(Math.abs(answer) * 0.15));
  let guard = 0;
  while (set.size < count && guard++ < 100) {
    const delta = int(rng, 1, spread) * (rng() < 0.5 ? -1 : 1);
    const v = answer + delta;
    if (v >= 0) set.add(v);
  }
  const values = shuffle(rng, [...set]);
  return { choices: values.map(String), answer: values.indexOf(answer) };
}

// --- Calcul éclair -----------------------------------------------------------

function calcQuestion(rng: Rng, level: number): Question {
  const lvl = Math.min(6, Math.max(1, level));
  const ops: ("+" | "-" | "×" | "÷")[] = lvl <= 2 ? ["+", "-"] : lvl === 3 ? ["+", "-", "×"] : ["+", "-", "×", "÷"];
  const op = ops[int(rng, 0, ops.length - 1)];
  const max = [20, 100, 1000, 10000, 100000, 100000][lvl - 1];
  let a: number, b: number, r: number;
  switch (op) {
    case "+":
      a = int(rng, 1, max / 2);
      b = int(rng, 1, max / 2);
      r = a + b;
      break;
    case "-":
      a = int(rng, 2, max);
      b = int(rng, 1, a - 1);
      r = a - b;
      break;
    case "×":
      a = int(rng, 2, lvl <= 3 ? 10 : lvl === 4 ? 99 : 999);
      b = int(rng, 2, lvl <= 4 ? 9 : 12);
      r = a * b;
      break;
    default:
      b = int(rng, 2, lvl <= 4 ? 9 : 12);
      r = int(rng, 2, lvl <= 4 ? 12 : 99);
      a = b * r;
  }
  return { prompt: `${a} ${op} ${b} = ?`, ...numberChoices(rng, r), dir: "ltr" };
}

// --- Tables de multiplication -----------------------------------------------

function tableQuestion(rng: Rng, level: number): Question {
  const top = level <= 2 ? 5 : 10;
  const a = int(rng, 2, top);
  const b = int(rng, 1, 10);
  return { prompt: `${a} × ${b} = ?`, ...numberChoices(rng, a * b), dir: "ltr" };
}

// --- Lettres (arabe) : retrouver la lettre qui manque --------------------------

const AR_WORDS: [string, string][] = [
  ["قلم", "✏️"], ["كتاب", "📖"], ["شمس", "☀️"], ["قمر", "🌙"], ["بيت", "🏠"], ["باب", "🚪"],
  ["سمكة", "🐟"], ["تفاحة", "🍎"], ["موز", "🍌"], ["قطّ", "🐱"], ["كلب", "🐶"], ["حصان", "🐴"],
  ["أسد", "🦁"], ["فيل", "🐘"], ["زرافة", "🦒"], ["شجرة", "🌳"], ["وردة", "🌹"], ["نجمة", "⭐"],
  ["سيّارة", "🚗"], ["طائرة", "✈️"], ["قطار", "🚆"], ["كرة", "⚽"], ["ساعة", "⏰"], ["مفتاح", "🔑"],
  ["حليب", "🥛"], ["خبز", "🍞"], ["جبل", "⛰️"], ["بحر", "🌊"], ["مدرسة", "🏫"], ["عين", "👁️"],
];
const AR_LETTERS = "بتثجحخدذرزسشصضطظعغفقكلمنهوي".split("");

function letterQuestion(rng: Rng): Question {
  const [word, emoji] = AR_WORDS[int(rng, 0, AR_WORDS.length - 1)];
  const chars = [...word];
  // On cache une lettre « simple » (pas de hamza ni de chadda).
  const positions = chars.map((c, i) => (AR_LETTERS.includes(c) ? i : -1)).filter((i) => i >= 0);
  const pos = positions[int(rng, 0, positions.length - 1)];
  const missing = chars[pos];
  const others = shuffle(rng, AR_LETTERS.filter((l) => l !== missing)).slice(0, 2);
  const choices = shuffle(rng, [missing, ...others]);
  const shown = chars.map((c, i) => (i === pos ? "ـ؟ـ" : c)).join("");
  return { prompt: shown, emoji, choices, answer: choices.indexOf(missing), dir: "rtl" };
}

// --- Mots (français) : choisir le mot qui correspond à l'image -----------------

const FR_WORDS: [string, string][] = [
  ["une pomme", "🍎"], ["un chat", "🐱"], ["un chien", "🐶"], ["le soleil", "☀️"], ["une maison", "🏠"],
  ["un livre", "📖"], ["une voiture", "🚗"], ["une fleur", "🌸"], ["un poisson", "🐟"], ["un arbre", "🌳"],
  ["la lune", "🌙"], ["une étoile", "⭐"], ["un ballon", "⚽"], ["du pain", "🍞"], ["du lait", "🥛"],
  ["un train", "🚆"], ["un avion", "✈️"], ["une clé", "🔑"], ["un cheval", "🐴"], ["un lion", "🦁"],
  ["un éléphant", "🐘"], ["une banane", "🍌"], ["une orange", "🍊"], ["un crayon", "✏️"], ["une école", "🏫"],
  ["la mer", "🌊"], ["une montagne", "⛰️"], ["un gâteau", "🎂"], ["un oiseau", "🐦"], ["une porte", "🚪"],
];

function wordQuestion(rng: Rng): Question {
  const picks = shuffle(rng, FR_WORDS).slice(0, 3);
  const [word, emoji] = picks[0];
  const choices = shuffle(rng, picks.map((p) => p[0]));
  return { prompt: "?", emoji, choices, answer: choices.indexOf(word), dir: "ltr" };
}

/** Les 10 questions d'une partie. `rng` permet des tests reproductibles. */
export function makeQuestions(game: GameKey, level: number, rng: Rng = Math.random): Question[] {
  return Array.from({ length: QUESTIONS_PER_GAME }, () => {
    switch (game) {
      case "calcul":
        return calcQuestion(rng, level);
      case "tables":
        return tableQuestion(rng, level);
      case "lettres":
        return letterQuestion(rng);
      case "mots":
        return wordQuestion(rng);
    }
  });
}

/** Petit générateur pseudo-aléatoire déterministe (tests). */
export function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Niveau (1 à 6) à partir du code du niveau scolaire (P1 ... P6). */
export function levelNumber(code: string | null | undefined): number {
  const m = /^P(\d)$/.exec(code ?? "");
  return m ? Number(m[1]) : code === "PREP" ? 1 : 6;
}
