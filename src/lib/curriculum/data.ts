/**
 * Référentiel du programme du primaire tunisien (1re à 6e année), par niveau,
 * matière, domaine et leçon.
 *
 * Établi d'après les programmes officiels du ministère de l'Éducation et
 * l'organisation des manuels du CNP. Ce sont des repères de progression :
 * l'ordre exact des leçons et leur découpage suivent le manuel de la classe,
 * que l'enseignant garde comme référence. Aucun texte des manuels n'est repris
 * ici (seulement les intitulés des notions, qui ne sont pas protégés).
 *
 * Format compact : chaque leçon est [trimestre, intitulé en français, intitulé en arabe].
 * Pour le français et l'anglais, l'intitulé est dans la langue de la matière (pas de traduction).
 */

export type Term = 1 | 2 | 3;
export type LessonRow = [term: Term, fr: string, ar: string];
export type DomainData = { fr: string; ar: string; lessons: LessonRow[] };
export type SubjectProgramme = {
  /** Compétence visée en fin d'année (formulation simplifiée). */
  competence: { fr: string; ar: string };
  domains: DomainData[];
};

export const PROGRAMME_LEVELS = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;
export type ProgrammeLevel = (typeof PROGRAMME_LEVELS)[number];
export const PROGRAMME_SUBJECTS = ["AR", "MATH", "FR", "EVEIL", "ISL", "EN", "HG", "CIV"] as const;
export type ProgrammeSubject = (typeof PROGRAMME_SUBJECTS)[number];

const d = (fr: string, ar: string, lessons: LessonRow[]): DomainData => ({ fr, ar, lessons });
/** Leçon dont l'intitulé est le même dans les deux langues (français, anglais). */
const same = (term: Term, title: string): LessonRow => [term, title, title];

export const PROGRAMME: Record<ProgrammeLevel, Partial<Record<ProgrammeSubject, SubjectProgramme>>> = {
  P1: {
    AR: {
      competence: {
        fr: "Lire et écrire des mots et des phrases courtes ; s'exprimer oralement sur des situations familières.",
        ar: "يقرأ ويكتب كلمات وجملا قصيرة ويتواصل مشافهة في وضعيات مألوفة.",
      },
      domains: [
        d("Communication orale", "التواصل الشفوي", [
          [1, "Se présenter et saluer", "التعريف بالنفس والتحية"],
          [1, "Décrire sa famille", "وصف العائلة"],
          [2, "Raconter un événement à partir d'images", "سرد حدث انطلاقا من صور"],
          [3, "Exprimer un besoin ou un avis", "التعبير عن حاجة أو رأي"],
        ]),
        d("Lecture", "القراءة", [
          [1, "Discrimination auditive des sons", "التمييز السمعي بين الأصوات"],
          [1, "Les lettres et leurs formes (début, milieu, fin de mot)", "الحروف وأشكالها في أول الكلمة ووسطها وآخرها"],
          [1, "Les voyelles courtes (fatha, damma, kasra)", "الحركات القصيرة: الفتحة والضمة والكسرة"],
          [2, "Les voyelles longues (madd)", "المدود: الألف والواو والياء"],
          [2, "Le sukun et la chadda", "السكون والشدة"],
          [2, "Le tanwin", "التنوين"],
          [3, "L'article « al » (lettres solaires et lunaires)", "ال الشمسية وال القمرية"],
          [3, "Lire des phrases et un petit texte", "قراءة جمل ونص قصير"],
        ]),
        d("Écriture et production écrite", "الكتابة والإنتاج الكتابي", [
          [1, "Graphisme et tracé des lettres", "الخط ورسم الحروف"],
          [2, "Copier des mots et des phrases", "نقل كلمات وجمل"],
          [2, "Dictée de mots", "إملاء كلمات"],
          [3, "Compléter et construire une phrase", "إتمام جملة وتركيبها"],
        ]),
      ],
    },
    MATH: {
      competence: {
        fr: "Résoudre des situations-problèmes avec les nombres jusqu'à 100, l'addition et la soustraction, et se repérer dans l'espace.",
        ar: "يحلّ وضعيات مشكل باستعمال الأعداد إلى 100 والجمع والطرح ويتموقع في الفضاء.",
      },
      domains: [
        d("Nombres et calcul", "الأعداد والحساب", [
          [1, "Les nombres de 0 à 5", "الأعداد من 0 إلى 5"],
          [1, "Les nombres de 6 à 10", "الأعداد من 6 إلى 10"],
          [1, "Comparer des nombres (plus que, moins que, égal)", "مقارنة الأعداد: أكبر من، أصغر من، يساوي"],
          [1, "L'addition (sens et écriture)", "الجمع: معناه وكتابته"],
          [2, "La soustraction (sens et écriture)", "الطرح: معناه وكتابته"],
          [2, "Les nombres de 10 à 20 (dizaine et unités)", "الأعداد من 10 إلى 20: العشرة والآحاد"],
          [2, "Les nombres jusqu'à 59", "الأعداد إلى 59"],
          [3, "Les nombres jusqu'à 100", "الأعداد إلى 100"],
          [3, "Addition et soustraction sans retenue", "الجمع والطرح دون احتفاظ"],
          [3, "La monnaie : le dinar et les pièces", "النقود: الدينار والقطع النقدية"],
        ]),
        d("Espace et géométrie", "الفضاء والهندسة", [
          [1, "Se repérer : devant, derrière, à droite, à gauche", "التموقع: أمام، خلف، يمين، يسار"],
          [2, "Les formes : carré, rectangle, triangle, cercle", "الأشكال: المربع والمستطيل والمثلث والدائرة"],
          [3, "Ligne droite et ligne courbe", "الخط المستقيم والخط المنحني"],
        ]),
        d("Mesure", "القيس", [
          [2, "Comparer des longueurs", "مقارنة الأطوال"],
          [3, "Les jours de la semaine", "أيام الأسبوع"],
        ]),
        d("Résolution de problèmes", "حل المسائل", [
          [2, "Résoudre un problème d'addition", "حل مسألة بالجمع"],
          [3, "Résoudre un problème de soustraction", "حل مسألة بالطرح"],
        ]),
      ],
    },
    EVEIL: {
      competence: {
        fr: "Observer son corps, les êtres vivants et son environnement proche, et adopter des gestes d'hygiène.",
        ar: "يلاحظ جسمه والكائنات الحية ومحيطه القريب ويتبنّى سلوكات صحية.",
      },
      domains: [
        d("Le corps humain et la santé", "جسم الإنسان والصحة", [
          [1, "Les parties du corps", "أجزاء الجسم"],
          [1, "Les cinq sens", "الحواس الخمس"],
          [2, "L'hygiène du corps et des dents", "نظافة الجسم والأسنان"],
          [2, "Une alimentation saine", "التغذية السليمة"],
        ]),
        d("Les êtres vivants", "الكائنات الحية", [
          [2, "Les animaux de mon entourage", "الحيوانات في محيطي"],
          [3, "Les plantes : les parties d'une plante", "النبتة وأجزاؤها"],
        ]),
        d("Matière et environnement", "المادة والمحيط", [
          [3, "L'eau dans la vie quotidienne", "الماء في حياتنا اليومية"],
          [3, "Le jour et la nuit", "الليل والنهار"],
        ]),
      ],
    },
    ISL: {
      competence: {
        fr: "Réciter des sourates courtes et connaître les premières règles de la vie du musulman.",
        ar: "يستظهر سورا قصيرة ويتعرّف المبادئ الأولى في حياة المسلم.",
      },
      domains: [
        d("Coran", "القرآن الكريم", [
          [1, "Sourate Al-Fatiha", "سورة الفاتحة"],
          [1, "Sourate Al-Ikhlas", "سورة الإخلاص"],
          [2, "Sourate Al-Falaq", "سورة الفلق"],
          [2, "Sourate An-Nas", "سورة الناس"],
          [3, "Sourate Al-Kawthar", "سورة الكوثر"],
        ]),
        d("Croyance et culte", "العقيدة والعبادات", [
          [1, "Dieu est mon créateur", "الله خالقي"],
          [2, "La propreté (at-tahara)", "الطهارة والنظافة"],
          [3, "Les ablutions", "الوضوء"],
        ]),
        d("Comportement", "الأخلاق والمعاملات", [
          [1, "Respecter ses parents", "طاعة الوالدين"],
          [2, "Dire bonjour et remercier", "آداب التحية والشكر"],
          [3, "Le bon voisinage", "حسن الجوار"],
        ]),
      ],
    },
  },

  P2: {
    AR: {
      competence: {
        fr: "Lire de courts textes avec fluidité et les comprendre ; produire quelques phrases liées.",
        ar: "يقرأ نصوصا قصيرة قراءة مسترسلة ويفهمها وينتج جملا مترابطة.",
      },
      domains: [
        d("Communication orale", "التواصل الشفوي", [
          [1, "Décrire une image", "وصف صورة"],
          [2, "Raconter une histoire courte", "سرد قصة قصيرة"],
          [3, "Dialoguer et donner son avis", "الحوار وإبداء الرأي"],
        ]),
        d("Lecture", "القراءة", [
          [1, "Thème : l'école", "محور المدرسة"],
          [1, "Thème : la famille", "محور العائلة"],
          [2, "Thème : la santé et l'hygiène", "محور الصحة والنظافة"],
          [2, "Thème : les animaux", "محور الحيوانات"],
          [3, "Thème : la nature et les saisons", "محور الطبيعة والفصول"],
          [3, "Thème : les métiers", "محور المهن"],
        ]),
        d("Langue et écriture", "اللغة والكتابة", [
          [1, "Le ta' marbouta et le ta' maftouha", "التاء المربوطة والتاء المفتوحة"],
          [2, "La hamza en début de mot", "الهمزة في أول الكلمة"],
          [2, "Le singulier, le duel et le pluriel", "المفرد والمثنى والجمع"],
          [3, "Le masculin et le féminin", "المذكر والمؤنث"],
        ]),
        d("Production écrite", "الإنتاج الكتابي", [
          [1, "Ordonner les phrases d'un récit", "ترتيب جمل قصة"],
          [2, "Compléter un récit", "إتمام قصة"],
          [3, "Écrire trois ou quatre phrases sur une image", "كتابة ثلاث أو أربع جمل انطلاقا من صورة"],
        ]),
      ],
    },
    MATH: {
      competence: {
        fr: "Résoudre des situations-problèmes avec les nombres jusqu'à 1000, l'addition, la soustraction et les débuts de la multiplication.",
        ar: "يحلّ وضعيات مشكل باستعمال الأعداد إلى 1000 والجمع والطرح وبداية الضرب.",
      },
      domains: [
        d("Nombres et calcul", "الأعداد والحساب", [
          [1, "Révision des nombres jusqu'à 100", "مراجعة الأعداد إلى 100"],
          [1, "L'addition avec retenue", "الجمع بالاحتفاظ"],
          [1, "La soustraction avec retenue", "الطرح بالاحتفاظ"],
          [2, "Les nombres jusqu'à 1000 (centaines)", "الأعداد إلى 1000: المئات"],
          [2, "Comparer et ranger les nombres", "مقارنة الأعداد وترتيبها"],
          [2, "Sens de la multiplication (additions répétées)", "معنى الضرب: الجمع المتكرر"],
          [3, "Les tables de multiplication par 2, 3, 4 et 5", "جداول الضرب في 2 و3 و4 و5"],
          [3, "Le partage (approche de la division)", "التوزيع والتقاسم: مدخل إلى القسمة"],
          [3, "La monnaie : dinar et millimes", "النقود: الدينار والمليم"],
        ]),
        d("Espace et géométrie", "الفضاء والهندسة", [
          [1, "Le quadrillage et les déplacements", "الشبكة والتنقل فيها"],
          [2, "Le segment de droite", "قطعة المستقيم"],
          [3, "Les solides : cube et pavé", "المجسمات: المكعب ومتوازي المستطيلات"],
        ]),
        d("Mesure", "القيس", [
          [2, "Mesurer des longueurs : le mètre et le centimètre", "قيس الأطوال: المتر والصنتيمتر"],
          [3, "Lire l'heure (heures et demi-heures)", "قراءة الساعة"],
        ]),
        d("Résolution de problèmes", "حل المسائل", [
          [1, "Problèmes à une étape (addition, soustraction)", "مسائل بعملية واحدة: الجمع والطرح"],
          [3, "Problèmes de multiplication", "مسائل بالضرب"],
        ]),
      ],
    },
    FR: {
      competence: {
        fr: "Comprendre et utiliser à l'oral des mots et des phrases simples de la vie quotidienne ; découvrir les premiers sons et lettres.",
        ar: "Comprendre et utiliser à l'oral des mots et des phrases simples de la vie quotidienne ; découvrir les premiers sons et lettres.",
      },
      domains: [
        d("Oral", "التواصل الشفوي", [
          same(1, "Saluer et se présenter"),
          same(1, "Les objets de la classe"),
          same(2, "La famille"),
          same(2, "Les couleurs et les nombres de 1 à 10"),
          same(3, "Les animaux"),
          same(3, "Les fruits et les légumes"),
        ]),
        d("Lecture et écriture", "القراءة والكتابة", [
          same(2, "Les voyelles a, i, o, u, e"),
          same(2, "Les sons [m], [l], [r]"),
          same(3, "Lire des syllabes et des mots simples"),
          same(3, "Écrire des lettres et des mots"),
        ]),
      ],
    },
    EVEIL: {
      competence: {
        fr: "Observer et décrire des êtres vivants, des objets et des phénomènes simples de son environnement.",
        ar: "يلاحظ ويصف كائنات حية وأشياء وظواهر بسيطة في محيطه.",
      },
      domains: [
        d("Les êtres vivants", "الكائنات الحية", [
          [1, "Les animaux domestiques et sauvages", "الحيوانات الأليفة والمتوحشة"],
          [1, "Comment se déplacent les animaux", "تنقل الحيوانات"],
          [2, "Ce que mangent les animaux", "تغذية الحيوانات"],
          [2, "La germination d'une graine", "إنبات البذرة"],
        ]),
        d("Le corps humain et la santé", "جسم الإنسان والصحة", [
          [1, "Les dents et leur entretien", "الأسنان والعناية بها"],
          [2, "Les aliments et leurs groupes", "الأغذية ومجموعاتها"],
        ]),
        d("Matière et énergie", "المادة والطاقة", [
          [3, "Les états de l'eau", "حالات الماء"],
          [3, "Objets qui flottent et objets qui coulent", "الأجسام الطافية والأجسام الراسبة"],
          [3, "La lumière et l'ombre", "الضوء والظل"],
        ]),
      ],
    },
    ISL: {
      competence: {
        fr: "Réciter des sourates courtes, connaître les piliers de l'islam et adopter de bons comportements.",
        ar: "يستظهر سورا قصيرة ويتعرّف أركان الإسلام ويتحلّى بالسلوك الحسن.",
      },
      domains: [
        d("Coran", "القرآن الكريم", [
          [1, "Sourate Al-Asr", "سورة العصر"],
          [1, "Sourate Al-Fil", "سورة الفيل"],
          [2, "Sourate Quraych", "سورة قريش"],
          [3, "Sourate Al-Ma'oun", "سورة الماعون"],
        ]),
        d("Croyance et culte", "العقيدة والعبادات", [
          [1, "Les piliers de l'islam", "أركان الإسلام"],
          [2, "La prière : les horaires", "الصلاة وأوقاتها"],
          [3, "Le jeûne du Ramadan", "صوم رمضان"],
        ]),
        d("Comportement et vie du Prophète", "الأخلاق والسيرة", [
          [1, "La naissance du Prophète", "مولد الرسول ﷺ"],
          [2, "La sincérité", "الصدق"],
          [3, "La propreté des lieux", "نظافة المحيط"],
        ]),
      ],
    },
  },

  P3: {
    AR: {
      competence: {
        fr: "Lire et comprendre des textes narratifs ; produire un paragraphe narratif court ; utiliser les premières règles de grammaire et de conjugaison.",
        ar: "يقرأ نصوصا سردية ويفهمها وينتج فقرة سردية قصيرة ويوظّف القواعد الأولى للنحو والصرف.",
      },
      domains: [
        d("Lecture", "القراءة", [
          [1, "Thème : la vie scolaire", "محور الحياة المدرسية"],
          [1, "Thème : la vie familiale", "محور الحياة العائلية"],
          [2, "Thème : la santé", "محور الصحة"],
          [2, "Thème : les animaux et la nature", "محور الحيوان والطبيعة"],
          [3, "Thème : le travail et les métiers", "محور العمل والمهن"],
          [3, "Thème : les loisirs et les voyages", "محور الترفيه والسفر"],
        ]),
        d("Grammaire et conjugaison", "قواعد اللغة", [
          [1, "La phrase nominale et la phrase verbale", "الجملة الاسمية والجملة الفعلية"],
          [1, "Le passé, le présent et l'impératif", "الماضي والمضارع والأمر"],
          [2, "Le sujet et le verbe", "الفعل والفاعل"],
          [2, "Les pronoms personnels", "الضمائر المنفصلة"],
          [3, "Les démonstratifs", "أسماء الإشارة"],
          [3, "Les relatifs", "الأسماء الموصولة"],
        ]),
        d("Orthographe", "الرسم", [
          [1, "La hamza de liaison et la hamza de coupure", "همزة الوصل وهمزة القطع"],
          [2, "Le alif final (alif maqsoura et alif mamdouda)", "الألف اللينة في آخر الكلمة"],
          [3, "La hamza au milieu du mot", "الهمزة المتوسطة"],
        ]),
        d("Production écrite", "الإنتاج الكتابي", [
          [1, "Rédiger le début d'un récit (situation initiale)", "كتابة الوضعية الافتتاحية لقصة"],
          [2, "Rédiger les événements d'un récit", "كتابة الأحداث"],
          [3, "Rédiger la fin d'un récit", "كتابة الوضعية الختامية"],
        ]),
      ],
    },
    MATH: {
      competence: {
        fr: "Résoudre des situations-problèmes avec les nombres jusqu'à 10 000, les quatre opérations, la monnaie et les figures planes.",
        ar: "يحلّ وضعيات مشكل باستعمال الأعداد إلى 10000 والعمليات الأربع والنقود والأشكال المستوية.",
      },
      domains: [
        d("Nombres et calcul", "الأعداد والحساب", [
          [1, "Les nombres jusqu'à 9999", "الأعداد إلى 9999"],
          [1, "Addition et soustraction posées", "الجمع والطرح العموديان"],
          [1, "Les tables de multiplication", "جداول الضرب"],
          [2, "Multiplier par un nombre d'un chiffre", "الضرب في عدد ذي رقم واحد"],
          [2, "Multiplier par 10, 100, 1000", "الضرب في 10 و100 و1000"],
          [2, "La division : sens et division exacte", "القسمة: معناها والقسمة الصحيحة"],
          [3, "La division avec reste", "القسمة بباق"],
          [3, "Les fractions simples : la moitié, le tiers, le quart", "الكسور البسيطة: النصف والثلث والربع"],
        ]),
        d("Espace et géométrie", "الفضاء والهندسة", [
          [1, "Droites parallèles et perpendiculaires", "المستقيمات المتوازية والمتعامدة"],
          [2, "L'angle droit", "الزاوية القائمة"],
          [2, "Le carré et le rectangle : propriétés", "المربع والمستطيل: خاصياتهما"],
          [3, "La symétrie axiale", "التناظر المحوري"],
        ]),
        d("Mesure", "القيس", [
          [1, "Les longueurs : m, dm, cm, mm", "الأطوال: المتر وأجزاؤه"],
          [2, "La monnaie : conversions dinars et millimes", "النقود: التحويل بين الدينار والمليم"],
          [3, "Le périmètre du carré et du rectangle", "محيط المربع والمستطيل"],
          [3, "La durée : heures et minutes", "الزمن: الساعة والدقيقة"],
        ]),
        d("Résolution de problèmes", "حل المسائل", [
          [2, "Problèmes à deux étapes", "مسائل بعمليتين"],
          [3, "Lire un tableau de données", "قراءة جدول معطيات"],
        ]),
      ],
    },
    FR: {
      competence: {
        fr: "Lire et comprendre des phrases et de courts textes ; écrire des phrases simples ; communiquer à l'oral dans des situations familières.",
        ar: "Lire et comprendre des phrases et de courts textes ; écrire des phrases simples ; communiquer à l'oral dans des situations familières.",
      },
      domains: [
        d("Oral", "التواصل الشفوي", [
          same(1, "Se présenter et présenter sa famille"),
          same(2, "Décrire sa maison et sa chambre"),
          same(3, "Parler de ses loisirs"),
        ]),
        d("Lecture", "القراءة", [
          same(1, "Les sons [ou], [on], [an]"),
          same(1, "Les sons [ch], [j], [g]"),
          same(2, "Les sons [é], [è], [eu]"),
          same(2, "Lire un petit texte : à l'école"),
          same(3, "Lire un petit texte : au marché"),
        ]),
        d("Langue", "اللغة", [
          same(1, "Le nom et l'article (un, une, le, la, les)"),
          same(2, "Le masculin et le féminin"),
          same(2, "Le singulier et le pluriel"),
          same(3, "Le verbe être au présent"),
          same(3, "Le verbe avoir au présent"),
        ]),
        d("Écriture", "الكتابة", [
          same(2, "Écrire une phrase à partir d'une image"),
          same(3, "Compléter un petit texte"),
        ]),
      ],
    },
    EVEIL: {
      competence: {
        fr: "Expliquer des phénomènes simples liés au vivant, à la santé et à la matière par l'observation et l'expérience.",
        ar: "يفسّر ظواهر بسيطة تتعلق بالكائن الحي والصحة والمادة بالملاحظة والتجربة.",
      },
      domains: [
        d("Le corps humain et la santé", "جسم الإنسان والصحة", [
          [1, "Le squelette et les articulations", "الهيكل العظمي والمفاصل"],
          [1, "Les muscles et le mouvement", "العضلات والحركة"],
          [2, "La digestion : le trajet des aliments", "الهضم: مسار الأغذية"],
        ]),
        d("Les êtres vivants", "الكائنات الحية", [
          [1, "La respiration des animaux", "تنفس الحيوانات"],
          [2, "La reproduction des animaux (ovipares et vivipares)", "تكاثر الحيوانات: البيوض والولود"],
          [2, "Les besoins de la plante", "حاجيات النبتة"],
        ]),
        d("Matière et énergie", "المادة والطاقة", [
          [3, "L'air : propriétés", "الهواء وخاصياته"],
          [3, "Mélanges et solutions", "الخلائط والمحاليل"],
          [3, "Le circuit électrique simple", "الدارة الكهربائية البسيطة"],
        ]),
      ],
    },
    ISL: {
      competence: {
        fr: "Réciter et comprendre des sourates, accomplir les ablutions et la prière, et adopter des valeurs de respect et d'entraide.",
        ar: "يستظهر سورا ويفهمها ويؤدّي الوضوء والصلاة ويتحلّى بقيم الاحترام والتعاون.",
      },
      domains: [
        d("Coran", "القرآن الكريم", [
          [1, "Sourate Al-Humaza", "سورة الهمزة"],
          [2, "Sourate At-Takathur", "سورة التكاثر"],
          [3, "Sourate Al-Qari'a", "سورة القارعة"],
        ]),
        d("Croyance et culte", "العقيدة والعبادات", [
          [1, "Les attributs de Dieu", "من صفات الله"],
          [2, "La prière : les étapes", "الصلاة: كيفيتها"],
          [3, "L'aumône (zakat al-fitr)", "زكاة الفطر"],
        ]),
        d("Comportement et vie du Prophète", "الأخلاق والسيرة", [
          [1, "L'entraide", "التعاون"],
          [2, "L'enfance du Prophète", "طفولة الرسول ﷺ"],
          [3, "Respecter les biens publics", "المحافظة على الملك العام"],
        ]),
      ],
    },
    CIV: {
      competence: {
        fr: "Connaître ses droits et devoirs à l'école et dans la famille, et respecter les règles de la vie en groupe.",
        ar: "يتعرّف حقوقه وواجباته في المدرسة والعائلة ويحترم قواعد العيش المشترك.",
      },
      domains: [
        d("Vivre ensemble", "العيش معا", [
          [1, "Le règlement de la classe", "نظام القسم"],
          [2, "Les droits de l'enfant", "حقوق الطفل"],
          [3, "Le code de la route du piéton", "قواعد السلامة المرورية للمترجل"],
        ]),
      ],
    },
  },

  P4: {
    AR: {
      competence: {
        fr: "Lire et comprendre des textes narratifs et descriptifs ; produire un récit avec description ; maîtriser les règles de grammaire du niveau.",
        ar: "يقرأ نصوصا سردية ووصفية ويفهمها وينتج نصا سرديا يتضمن وصفا ويوظّف قواعد اللغة المقررة.",
      },
      domains: [
        d("Lecture", "القراءة", [
          [1, "Thème : la vie scolaire et les amis", "محور الحياة المدرسية والأصدقاء"],
          [1, "Thème : la ville et la campagne", "محور المدينة والريف"],
          [2, "Thème : l'environnement", "محور المحيط"],
          [2, "Thème : la solidarité", "محور التضامن"],
          [3, "Thème : les sciences et l'invention", "محور العلم والاختراع"],
          [3, "Thème : les voyages", "محور الأسفار"],
        ]),
        d("Grammaire et conjugaison", "قواعد اللغة", [
          [1, "Le sujet (al-fa'il)", "الفاعل"],
          [1, "Le complément d'objet (al-maf'oul bihi)", "المفعول به"],
          [2, "Le mubtada' et le khabar", "المبتدأ والخبر"],
          [2, "Kana et ses sœurs", "كان وأخواتها"],
          [3, "Inna et ses sœurs", "إنّ وأخواتها"],
          [3, "L'adjectif (an-na't)", "النعت"],
        ]),
        d("Orthographe", "الرسم", [
          [1, "La hamza finale", "الهمزة المتطرفة"],
          [2, "Le tanwin et ses formes", "التنوين وأشكاله"],
        ]),
        d("Production écrite", "الإنتاج الكتابي", [
          [1, "Insérer une description dans un récit", "إدماج الوصف في السرد"],
          [2, "Insérer un dialogue dans un récit", "إدماج الحوار في السرد"],
          [3, "Rédiger un récit complet", "كتابة قصة كاملة"],
        ]),
      ],
    },
    MATH: {
      competence: {
        fr: "Résoudre des situations-problèmes avec les grands nombres, les quatre opérations, les fractions simples, les mesures et le périmètre.",
        ar: "يحلّ وضعيات مشكل باستعمال الأعداد الكبيرة والعمليات الأربع والكسور البسيطة والقيس والمحيط.",
      },
      domains: [
        d("Nombres et calcul", "الأعداد والحساب", [
          [1, "Les nombres jusqu'à 999 999 (classes des mille)", "الأعداد إلى 999999: صنف الآلاف"],
          [1, "Multiplier par un nombre de deux chiffres", "الضرب في عدد ذي رقمين"],
          [2, "La division par un nombre d'un chiffre", "القسمة على عدد ذي رقم واحد"],
          [2, "Les multiples et les diviseurs", "المضاعفات والقواسم"],
          [2, "Les fractions : lire, écrire, représenter", "الكسور: قراءتها وكتابتها وتمثيلها"],
          [3, "Comparer des fractions de même dénominateur", "مقارنة كسور لها نفس المقام"],
          [3, "Addition de fractions de même dénominateur", "جمع كسور لها نفس المقام"],
        ]),
        d("Espace et géométrie", "الفضاء والهندسة", [
          [1, "Les angles : droit, aigu, obtus", "الزوايا: القائمة والحادة والمنفرجة"],
          [2, "Le cercle : centre, rayon, diamètre", "الدائرة: المركز والشعاع والقطر"],
          [2, "Les triangles", "المثلثات"],
          [3, "Le losange et le parallélogramme", "المعين ومتوازي الأضلاع"],
        ]),
        d("Mesure", "القيس", [
          [1, "Les longueurs : km, m, cm, mm et conversions", "الأطوال وتحويلاتها"],
          [2, "Les masses : kg, g", "الكتل: الكلغ والغرام"],
          [2, "Les capacités : l, dl, cl", "السعة: اللتر وأجزاؤه"],
          [3, "Le périmètre des polygones", "محيط المضلعات"],
        ]),
        d("Résolution de problèmes", "حل المسائل", [
          [2, "Problèmes à plusieurs étapes", "مسائل بعدة عمليات"],
          [3, "Lire et construire un graphique simple", "قراءة رسم بياني بسيط وإنجازه"],
        ]),
      ],
    },
    FR: {
      competence: {
        fr: "Lire et comprendre un court texte narratif ; écrire quelques phrases cohérentes ; employer les accords et le présent des verbes usuels.",
        ar: "Lire et comprendre un court texte narratif ; écrire quelques phrases cohérentes ; employer les accords et le présent des verbes usuels.",
      },
      domains: [
        d("Oral", "التواصل الشفوي", [
          same(1, "Raconter sa journée"),
          same(2, "Décrire une personne"),
          same(3, "Demander et indiquer un chemin"),
        ]),
        d("Lecture", "القراءة", [
          same(1, "Comprendre un texte : qui, où, quand ?"),
          same(2, "Le conte : personnages et lieux"),
          same(3, "Lire une recette ou une consigne"),
        ]),
        d("Langue", "اللغة", [
          same(1, "La phrase : majuscule et point"),
          same(1, "Les verbes du 1er groupe au présent"),
          same(2, "L'adjectif qualificatif et son accord"),
          same(2, "Les verbes aller, faire, dire au présent"),
          same(3, "La phrase négative"),
          same(3, "La phrase interrogative"),
        ]),
        d("Écriture", "الكتابة", [
          same(1, "Écrire une carte d'invitation"),
          same(2, "Décrire un animal en quelques phrases"),
          same(3, "Raconter un événement en quelques phrases"),
        ]),
      ],
    },
    EN: {
      competence: {
        fr: "Comprendre et utiliser à l'oral des mots et des expressions simples de la vie quotidienne.",
        ar: "Comprendre et utiliser à l'oral des mots et des expressions simples de la vie quotidienne.",
      },
      domains: [
        d("Speaking and listening", "Speaking and listening", [
          same(1, "Greetings and introductions"),
          same(1, "Numbers 1 to 10"),
          same(2, "Colours and classroom objects"),
          same(2, "My family"),
          same(3, "Animals"),
          same(3, "Food I like"),
        ]),
      ],
    },
    EVEIL: {
      competence: {
        fr: "Expliquer le fonctionnement du corps, la vie des plantes et des animaux, et des phénomènes physiques simples.",
        ar: "يفسّر وظائف الجسم وحياة النباتات والحيوانات وظواهر فيزيائية بسيطة.",
      },
      domains: [
        d("Le corps humain et la santé", "جسم الإنسان والصحة", [
          [1, "La respiration chez l'homme", "التنفس عند الإنسان"],
          [1, "La circulation du sang", "الدورة الدموية"],
          [2, "Les microbes et la prévention", "الجراثيم والوقاية"],
        ]),
        d("Les êtres vivants", "الكائنات الحية", [
          [1, "La reproduction des plantes à fleurs", "تكاثر النباتات الزهرية"],
          [2, "Les chaînes alimentaires", "السلاسل الغذائية"],
        ]),
        d("Matière et énergie", "المادة والطاقة", [
          [2, "Les changements d'état de l'eau", "تغيّر حالات الماء"],
          [3, "Conducteurs et isolants électriques", "الموصلات والعوازل الكهربائية"],
          [3, "Les aimants", "المغناطيس"],
          [3, "Le son", "الصوت"],
        ]),
      ],
    },
    ISL: {
      competence: {
        fr: "Réciter et expliquer des sourates, accomplir correctement la prière et le jeûne, et s'inspirer de la vie du Prophète.",
        ar: "يستظهر سورا ويشرحها ويؤدّي الصلاة والصوم أداء سليما ويقتدي بسيرة الرسول ﷺ.",
      },
      domains: [
        d("Coran", "القرآن الكريم", [
          [1, "Sourate Al-'Adiyat", "سورة العاديات"],
          [2, "Sourate Az-Zalzala", "سورة الزلزلة"],
          [3, "Sourate Al-Bayyina", "سورة البينة"],
        ]),
        d("Croyance et culte", "العقيدة والعبادات", [
          [1, "Les piliers de la foi", "أركان الإيمان"],
          [2, "Ce qui annule les ablutions", "نواقض الوضوء"],
          [3, "Le jeûne : règles et bienfaits", "الصوم: أحكامه وفوائده"],
        ]),
        d("Comportement et vie du Prophète", "الأخلاق والسيرة", [
          [1, "La Révélation", "نزول الوحي"],
          [2, "La patience", "الصبر"],
          [3, "La protection de l'environnement", "المحافظة على البيئة"],
        ]),
      ],
    },
    CIV: {
      competence: {
        fr: "Connaître les institutions proches (école, municipalité) et les règles de la citoyenneté.",
        ar: "يتعرّف المؤسسات القريبة منه (المدرسة، البلدية) وقواعد المواطنة.",
      },
      domains: [
        d("Citoyenneté", "المواطنة", [
          [1, "Le conseil des élèves", "مجلس التلاميذ"],
          [2, "La municipalité et ses services", "البلدية وخدماتها"],
          [3, "Les symboles de la nation : drapeau et hymne", "رموز الوطن: العلم والنشيد الرسمي"],
        ]),
      ],
    },
  },

  P5: {
    AR: {
      competence: {
        fr: "Lire et comprendre des textes variés ; produire un texte narratif ou descriptif structuré ; maîtriser les règles de grammaire du niveau.",
        ar: "يقرأ نصوصا متنوّعة ويفهمها وينتج نصا سرديا أو وصفيا متماسكا ويوظّف القواعد المقررة.",
      },
      domains: [
        d("Lecture", "القراءة", [
          [1, "Thème : l'enfance", "محور الطفولة"],
          [1, "Thème : la famille et la société", "محور العائلة والمجتمع"],
          [2, "Thème : la patrie", "محور الوطن"],
          [2, "Thème : la nature", "محور الطبيعة"],
          [3, "Thème : les sciences et la technologie", "محور العلم والتكنولوجيا"],
          [3, "Thème : le travail", "محور العمل"],
        ]),
        d("Grammaire et conjugaison", "قواعد اللغة", [
          [1, "Le verbe sain et le verbe défectueux", "الفعل الصحيح والفعل المعتل"],
          [1, "Le complément de temps et de lieu", "المفعول فيه"],
          [2, "Le complément de cause", "المفعول لأجله"],
          [2, "Le hal (complément d'état)", "الحال"],
          [3, "Le tamyiz", "التمييز"],
          [3, "Le complément du nom (al-idafa)", "المضاف إليه"],
        ]),
        d("Production écrite", "الإنتاج الكتابي", [
          [1, "Décrire un personnage (physique et moral)", "وصف شخصية: ملامحها وطباعها"],
          [2, "Décrire un lieu", "وصف مكان"],
          [3, "Rédiger un récit avec dialogue et description", "كتابة نص سردي يتضمن حوارا ووصفا"],
        ]),
      ],
    },
    MATH: {
      competence: {
        fr: "Résoudre des situations-problèmes avec les fractions, les nombres décimaux, la proportionnalité, les aires et les angles.",
        ar: "يحلّ وضعيات مشكل باستعمال الكسور والأعداد العشرية والتناسب والمساحات والزوايا.",
      },
      domains: [
        d("Nombres et calcul", "الأعداد والحساب", [
          [1, "Les nombres au-delà du million", "الأعداد الكبيرة: صنف الملايين"],
          [1, "La division par un nombre de deux chiffres", "القسمة على عدد ذي رقمين"],
          [1, "Les fractions équivalentes", "الكسور المتكافئة"],
          [2, "Addition et soustraction de fractions", "جمع الكسور وطرحها"],
          [2, "Les nombres décimaux : lire, écrire, comparer", "الأعداد العشرية: قراءتها وكتابتها ومقارنتها"],
          [2, "Addition et soustraction de décimaux", "جمع الأعداد العشرية وطرحها"],
          [3, "Multiplier un décimal par un entier", "ضرب عدد عشري في عدد صحيح"],
          [3, "La proportionnalité", "التناسب"],
        ]),
        d("Espace et géométrie", "الفضاء والهندسة", [
          [1, "Mesurer et tracer un angle avec le rapporteur", "قيس زاوية ورسمها بالمنقلة"],
          [2, "Les quadrilatères particuliers", "الرباعيات الخاصة"],
          [3, "Le pavé droit et le cube : patrons", "متوازي المستطيلات والمكعب: النشر"],
        ]),
        d("Mesure", "القيس", [
          [1, "Les unités de mesure et les conversions", "وحدات القيس وتحويلاتها"],
          [2, "L'aire du carré et du rectangle", "مساحة المربع والمستطيل"],
          [3, "L'aire du triangle", "مساحة المثلث"],
          [3, "Les durées : calculer un temps écoulé", "حساب المدة الزمنية"],
        ]),
        d("Résolution de problèmes", "حل المسائل", [
          [2, "Problèmes de partage et de fractions", "مسائل التقسيم والكسور"],
          [3, "Lire et interpréter des diagrammes", "قراءة المخططات وتأويلها"],
        ]),
      ],
    },
    FR: {
      competence: {
        fr: "Lire et comprendre des textes narratifs et descriptifs ; produire un paragraphe cohérent ; employer le présent, le passé composé et le futur.",
        ar: "Lire et comprendre des textes narratifs et descriptifs ; produire un paragraphe cohérent ; employer le présent, le passé composé et le futur.",
      },
      domains: [
        d("Oral", "التواصل الشفوي", [
          same(1, "Raconter un souvenir de vacances"),
          same(2, "Exprimer ses goûts et ses préférences"),
          same(3, "Présenter un métier"),
        ]),
        d("Lecture", "القراءة", [
          same(1, "Le schéma narratif d'un conte"),
          same(2, "Le texte descriptif : décrire un lieu"),
          same(3, "La lettre et le message"),
        ]),
        d("Langue", "اللغة", [
          same(1, "Le groupe nominal"),
          same(1, "Le passé composé avec avoir"),
          same(2, "Le passé composé avec être"),
          same(2, "Le futur simple"),
          same(3, "Les compléments de temps et de lieu"),
          same(3, "Les homophones a/à, et/est, son/sont"),
        ]),
        d("Écriture", "الكتابة", [
          same(1, "Écrire la suite d'un récit"),
          same(2, "Décrire un personnage"),
          same(3, "Écrire une lettre à un ami"),
        ]),
      ],
    },
    EN: {
      competence: {
        fr: "Comprendre et produire à l'oral et à l'écrit des phrases simples sur soi et son environnement.",
        ar: "Comprendre et produire à l'oral et à l'écrit des phrases simples sur soi et son environnement.",
      },
      domains: [
        d("Language skills", "Language skills", [
          same(1, "Hello! Talking about myself"),
          same(1, "My school and my classroom"),
          same(2, "My house and my room"),
          same(2, "Days of the week and daily routines"),
          same(3, "Clothes and the weather"),
          same(3, "Sports and hobbies"),
        ]),
      ],
    },
    EVEIL: {
      competence: {
        fr: "Mener une démarche d'investigation pour expliquer des phénomènes liés au vivant, à la santé et à la matière.",
        ar: "يعتمد التمشي الاستقصائي لتفسير ظواهر تتعلق بالكائن الحي والصحة والمادة.",
      },
      domains: [
        d("Le corps humain et la santé", "جسم الإنسان والصحة", [
          [1, "L'appareil digestif", "الجهاز الهضمي"],
          [1, "L'équilibre alimentaire", "التوازن الغذائي"],
          [2, "L'appareil respiratoire et la santé", "الجهاز التنفسي والصحة"],
        ]),
        d("Les êtres vivants et l'environnement", "الكائنات الحية والمحيط", [
          [2, "La nutrition des plantes vertes", "تغذية النباتات الخضراء"],
          [2, "L'équilibre de l'écosystème", "التوازن البيئي"],
        ]),
        d("Matière et énergie", "المادة والطاقة", [
          [1, "La masse et le volume", "الكتلة والحجم"],
          [3, "La dilatation", "التمدد"],
          [3, "Les sources d'énergie", "مصادر الطاقة"],
          [3, "Le circuit électrique en série et en dérivation", "التركيب على التسلسل وعلى التوازي"],
        ]),
      ],
    },
    ISL: {
      competence: {
        fr: "Réciter et expliquer des sourates, connaître les règles du culte et les grandes étapes de la vie du Prophète.",
        ar: "يستظهر سورا ويشرحها ويتعرّف أحكام العبادات والمراحل الكبرى من السيرة النبوية.",
      },
      domains: [
        d("Coran", "القرآن الكريم", [
          [1, "Sourate Al-Qadr", "سورة القدر"],
          [2, "Sourate Al-'Alaq (extrait)", "سورة العلق"],
          [3, "Sourate At-Tin", "سورة التين"],
        ]),
        d("Croyance et culte", "العقيدة والعبادات", [
          [1, "La prière en commun et la prière du vendredi", "صلاة الجماعة وصلاة الجمعة"],
          [2, "La zakat", "الزكاة"],
          [3, "Le pèlerinage (al-hajj)", "الحج"],
        ]),
        d("Comportement et vie du Prophète", "الأخلاق والسيرة", [
          [1, "L'Hégire", "الهجرة النبوية"],
          [2, "La fraternité entre Muhajirun et Ansar", "المؤاخاة بين المهاجرين والأنصار"],
          [3, "Le travail et la persévérance", "العمل والمثابرة"],
        ]),
      ],
    },
    HG: {
      competence: {
        fr: "Se repérer dans le temps et dans l'espace tunisien : grandes périodes de l'histoire ancienne et milieux naturels de la Tunisie.",
        ar: "يتموقع في الزمان والمكان: الفترات الكبرى من التاريخ القديم والأوساط الطبيعية بالبلاد التونسية.",
      },
      domains: [
        d("Histoire", "التاريخ", [
          [1, "Le temps historique : siècle et frise chronologique", "الزمن التاريخي: القرن والخط الزمني"],
          [1, "La préhistoire en Tunisie", "ما قبل التاريخ بالبلاد التونسية"],
          [2, "Carthage : fondation et civilisation", "قرطاج: تأسيسها وحضارتها"],
          [2, "La Tunisie à l'époque romaine", "البلاد التونسية في العهد الروماني"],
          [3, "La conquête arabo-musulmane et Kairouan", "الفتح العربي الإسلامي وتأسيس القيروان"],
        ]),
        d("Géographie", "الجغرافيا", [
          [1, "Lire une carte : échelle, légende, orientation", "قراءة الخريطة: السلم والمفتاح والاتجاهات"],
          [2, "La position de la Tunisie et ses frontières", "موقع البلاد التونسية وحدودها"],
          [2, "Le relief de la Tunisie", "تضاريس البلاد التونسية"],
          [3, "Le climat de la Tunisie", "مناخ البلاد التونسية"],
          [3, "Les ressources en eau", "الموارد المائية"],
        ]),
      ],
    },
    CIV: {
      competence: {
        fr: "Connaître les droits et devoirs du citoyen et les règles de la vie démocratique à l'école et dans la commune.",
        ar: "يتعرّف حقوق المواطن وواجباته وقواعد الحياة الديمقراطية في المدرسة والبلدية.",
      },
      domains: [
        d("Citoyenneté", "المواطنة", [
          [1, "Droits et devoirs", "الحقوق والواجبات"],
          [2, "Les élections et le vote", "الانتخابات والتصويت"],
          [3, "Les associations et le bénévolat", "الجمعيات والعمل التطوعي"],
        ]),
      ],
    },
  },

  P6: {
    AR: {
      competence: {
        fr: "Lire et comprendre des textes variés ; produire un texte structuré (narratif, descriptif, argumentatif simple) ; maîtriser les règles du primaire.",
        ar: "يقرأ نصوصا متنوّعة ويفهمها وينتج نصا متماسكا (سرديا أو وصفيا أو حجاجيا بسيطا) ويوظّف قواعد اللغة المقررة في المرحلة.",
      },
      domains: [
        d("Lecture", "القراءة", [
          [1, "Thème : les valeurs humaines", "محور القيم الإنسانية"],
          [1, "Thème : la patrie et ses héros", "محور الوطن وأعلامه"],
          [2, "Thème : la science et les découvertes", "محور العلم والاكتشافات"],
          [2, "Thème : l'environnement et la santé", "محور البيئة والصحة"],
          [3, "Thème : la communication et les médias", "محور التواصل والإعلام"],
          [3, "Thème : les arts et les loisirs", "محور الفنون والترفيه"],
        ]),
        d("Grammaire et conjugaison", "قواعد اللغة", [
          [1, "Le verbe transitif et intransitif", "الفعل اللازم والفعل المتعدي"],
          [1, "Le passif (al-majhoul)", "المبني للمجهول ونائب الفاعل"],
          [2, "L'apposition (al-badal)", "البدل"],
          [2, "La coordination (al-'atf)", "العطف"],
          [3, "Les nombres en arabe (accord)", "العدد والمعدود"],
          [3, "Les cinq noms", "الأسماء الخمسة"],
        ]),
        d("Production écrite", "الإنتاج الكتابي", [
          [1, "Rédiger un récit à partir d'un plan", "كتابة نص سردي انطلاقا من تصميم"],
          [2, "Exprimer et justifier un avis", "إبداء الرأي وتعليله"],
          [3, "Préparer l'épreuve d'expression écrite du concours", "الاستعداد لاختبار الإنتاج الكتابي في المناظرة"],
        ]),
      ],
    },
    MATH: {
      competence: {
        fr: "Résoudre des situations-problèmes complexes avec les décimaux, les fractions, les pourcentages, les échelles, les aires et les volumes.",
        ar: "يحلّ وضعيات مشكل مركّبة باستعمال الأعداد العشرية والكسور والنسب المائوية والسلّم والمساحات والأحجام.",
      },
      domains: [
        d("Nombres et calcul", "الأعداد والحساب", [
          [1, "Multiplication de deux décimaux", "ضرب عددين عشريين"],
          [1, "Division décimale", "القسمة العشرية"],
          [1, "Multiplication d'une fraction par un entier", "ضرب كسر في عدد صحيح"],
          [2, "Les pourcentages", "النسبة المائوية"],
          [2, "Proportionnalité et règle de trois", "التناسب والقاعدة الثلاثية"],
          [3, "La moyenne arithmétique", "المعدل الحسابي"],
        ]),
        d("Espace et géométrie", "الفضاء والهندسة", [
          [1, "Médiatrice et bissectrice", "الموسط العمودي ومنصف الزاوية"],
          [2, "Le disque et le cercle", "القرص والدائرة"],
          [3, "Le cylindre", "الأسطوانة"],
        ]),
        d("Mesure", "القيس", [
          [1, "L'aire du losange, du parallélogramme et du trapèze", "مساحة المعين ومتوازي الأضلاع وشبه المنحرف"],
          [2, "Le périmètre et l'aire du disque", "محيط الدائرة ومساحة القرص"],
          [2, "Les échelles", "السلم"],
          [3, "Le volume du pavé et du cube", "حجم متوازي المستطيلات والمكعب"],
          [3, "La vitesse moyenne", "السرعة المتوسطة"],
        ]),
        d("Résolution de problèmes", "حل المسائل", [
          [2, "Problèmes de pourcentages et de remises", "مسائل النسبة المائوية والتخفيض"],
          [3, "Problèmes de synthèse (préparation au concours)", "مسائل تأليفية: الاستعداد للمناظرة"],
        ]),
      ],
    },
    FR: {
      competence: {
        fr: "Lire et comprendre des textes variés ; produire un texte narratif ou descriptif d'une quinzaine de lignes ; maîtriser les temps de l'indicatif usuels.",
        ar: "Lire et comprendre des textes variés ; produire un texte narratif ou descriptif d'une quinzaine de lignes ; maîtriser les temps de l'indicatif usuels.",
      },
      domains: [
        d("Oral", "التواصل الشفوي", [
          same(1, "Raconter une histoire lue"),
          same(2, "Donner son avis et le justifier"),
          same(3, "Présenter un exposé simple"),
        ]),
        d("Lecture", "القراءة", [
          same(1, "Le récit : les étapes et les personnages"),
          same(2, "Le portrait"),
          same(3, "Le texte informatif"),
        ]),
        d("Langue", "اللغة", [
          same(1, "L'imparfait de l'indicatif"),
          same(1, "Imparfait et passé composé dans le récit"),
          same(2, "Le pronom personnel complément"),
          same(2, "La phrase complexe : et, mais, parce que"),
          same(3, "L'accord du participe passé avec être"),
          same(3, "Le discours direct"),
        ]),
        d("Écriture", "الكتابة", [
          same(1, "Rédiger un récit à partir d'images"),
          same(2, "Faire le portrait d'un personnage"),
          same(3, "Rédiger la fin d'une histoire"),
        ]),
      ],
    },
    EN: {
      competence: {
        fr: "Comprendre de courts textes et échanger simplement à l'oral et à l'écrit sur des sujets familiers.",
        ar: "Comprendre de courts textes et échanger simplement à l'oral et à l'écrit sur des sujets familiers.",
      },
      domains: [
        d("Language skills", "Language skills", [
          same(1, "Talking about my family and friends"),
          same(1, "Telling the time"),
          same(2, "Shopping and prices"),
          same(2, "Places in town and directions"),
          same(3, "Health and the body"),
          same(3, "Holidays and travelling"),
        ]),
      ],
    },
    EVEIL: {
      competence: {
        fr: "Expliquer des phénomènes liés à la reproduction, à la santé, à l'énergie et à l'environnement, et agir pour le préserver.",
        ar: "يفسّر ظواهر تتعلق بالتكاثر والصحة والطاقة والمحيط ويتصرّف للمحافظة عليه.",
      },
      domains: [
        d("Le corps humain et la santé", "جسم الإنسان والصحة", [
          [1, "La reproduction chez l'homme et la puberté", "التكاثر عند الإنسان والبلوغ"],
          [1, "L'appareil urinaire", "الجهاز البولي"],
          [2, "Les dangers du tabac et des drogues", "مخاطر التدخين والمخدرات"],
        ]),
        d("Les êtres vivants et l'environnement", "الكائنات الحية والمحيط", [
          [2, "La pollution de l'air, de l'eau et du sol", "تلوث الهواء والماء والتربة"],
          [2, "Le recyclage des déchets", "رسكلة الفضلات"],
        ]),
        d("Matière et énergie", "المادة والطاقة", [
          [1, "La combustion", "الاحتراق"],
          [3, "La lumière et sa propagation", "الضوء وانتشاره"],
          [3, "Les leviers et les machines simples", "الروافع والآلات البسيطة"],
          [3, "Les énergies renouvelables", "الطاقات المتجددة"],
        ]),
      ],
    },
    ISL: {
      competence: {
        fr: "Réciter et expliquer des sourates, connaître les grandes valeurs de l'islam et les étapes de la vie du Prophète.",
        ar: "يستظهر سورا ويشرحها ويتعرّف القيم الكبرى للإسلام ومراحل السيرة النبوية.",
      },
      domains: [
        d("Coran", "القرآن الكريم", [
          [1, "Sourate Ach-Charh", "سورة الشرح"],
          [2, "Sourate Ad-Duha", "سورة الضحى"],
          [3, "Sourate Al-Layl", "سورة الليل"],
        ]),
        d("Croyance et culte", "العقيدة والعبادات", [
          [1, "Les noms de Dieu", "أسماء الله الحسنى"],
          [2, "Les invocations et le rappel de Dieu", "الدعاء والذكر"],
          [3, "Les fêtes religieuses", "الأعياد الدينية"],
        ]),
        d("Comportement et vie du Prophète", "الأخلاق والسيرة", [
          [1, "La bataille de Badr", "غزوة بدر"],
          [2, "La conquête de La Mecque", "فتح مكة"],
          [3, "La tolérance et le dialogue", "التسامح والحوار"],
        ]),
      ],
    },
    HG: {
      competence: {
        fr: "Situer les grandes étapes de l'histoire de la Tunisie jusqu'à l'indépendance et décrire la population et les activités économiques du pays.",
        ar: "يتعرّف المراحل الكبرى من تاريخ البلاد التونسية إلى الاستقلال ويصف السكان والأنشطة الاقتصادية.",
      },
      domains: [
        d("Histoire", "التاريخ", [
          [1, "Les Aghlabides", "الأغالبة"],
          [1, "Les Fatimides et Mahdia", "الفاطميون والمهدية"],
          [2, "Les Hafsides", "الحفصيون"],
          [2, "La Tunisie ottomane et les Husseinites", "البلاد التونسية في العهد العثماني والحسينيون"],
          [3, "Le protectorat français", "الحماية الفرنسية"],
          [3, "Le mouvement national et l'indépendance", "الحركة الوطنية والاستقلال"],
        ]),
        d("Géographie", "الجغرافيا", [
          [1, "La population tunisienne", "السكان بالبلاد التونسية"],
          [2, "L'agriculture", "الفلاحة"],
          [2, "L'industrie", "الصناعة"],
          [3, "Le tourisme et les services", "السياحة والخدمات"],
          [3, "La Tunisie dans le Maghreb et dans le monde", "البلاد التونسية في المغرب العربي والعالم"],
        ]),
      ],
    },
    CIV: {
      competence: {
        fr: "Connaître les institutions de l'État tunisien et les valeurs de la citoyenneté.",
        ar: "يتعرّف مؤسسات الدولة التونسية وقيم المواطنة.",
      },
      domains: [
        d("Citoyenneté", "المواطنة", [
          [1, "La Constitution", "الدستور"],
          [2, "Les institutions de l'État", "مؤسسات الدولة"],
          [3, "Les droits de l'homme", "حقوق الإنسان"],
        ]),
      ],
    },
  },
};
