import type { Locale } from "@/i18n/config";

/**
 * Textes de la politique de confidentialité et de la page « supprimer mon
 * compte ». Le Play Store et l'App Store exigent ces deux pages, accessibles
 * sans être connecté.
 */

/** Adresse de contact affichée (variable CONTACT_EMAIL sur Render). */
export function contactEmail(): string | null {
  const raw = process.env.CONTACT_EMAIL ?? process.env.PUSH_CONTACT?.replace(/^mailto:/, "");
  if (!raw || raw.endsWith("@example.com") || !raw.includes("@")) return null;
  return raw.trim();
}

export const LEGAL_UPDATED = "2026-11-22";

type Section = { title: string; paragraphs: string[] };
type LegalText = {
  privacyTitle: string;
  deletionTitle: string;
  updated: string;
  privacy: Section[];
  deletion: Section[];
  contactLine: (email: string | null) => string;
  privacyLink: string;
  deletionLink: string;
  back: string;
};

export const legal: Record<Locale, LegalText> = {
  fr: {
    privacyTitle: "Politique de confidentialité",
    deletionTitle: "Supprimer mon compte",
    updated: "Dernière mise à jour",
    privacyLink: "Confidentialité",
    deletionLink: "Supprimer mon compte",
    back: "Retour à la connexion",
    contactLine: (email) =>
      email
        ? `Pour toute question sur vos données, écrivez à ${email} ou adressez-vous à l'administration de votre école.`
        : "Pour toute question sur vos données, adressez-vous à l'administration de votre école.",
    privacy: [
      {
        title: "Qui sommes-nous",
        paragraphs: [
          "Plateforme École est un service de gestion scolaire utilisé par des écoles privées. Chaque école est responsable des données de ses élèves, de leurs parents et de son personnel. L'éditeur de la plateforme (Abroudtech) héberge et traite ces données pour le compte de l'école, uniquement pour faire fonctionner le service.",
        ],
      },
      {
        title: "Les données que nous traitons",
        paragraphs: [
          "Identité et contact : nom et prénom (en français et en arabe), date et lieu de naissance des élèves, téléphone, e-mail et WhatsApp des parents et du personnel.",
          "Vie scolaire : classes, emplois du temps, notes, appréciations, bulletins, absences et justificatifs, devoirs, messages échangés avec l'école, annonces, activités et scores des jeux éducatifs.",
          "Paiements : frais de scolarité, paiements enregistrés par l'école et reçus. Aucune carte bancaire n'est saisie dans l'application.",
          "Données techniques : un cookie de connexion (indispensable), l'historique des tentatives de connexion pour bloquer les abus, et, si vous les acceptez, l'adresse technique de votre appareil pour recevoir les notifications.",
          "Nous n'utilisons aucune publicité, aucun outil de suivi commercial, et nous ne vendons aucune donnée.",
        ],
      },
      {
        title: "Pourquoi nous les utilisons",
        paragraphs: [
          "Uniquement pour le fonctionnement de l'école : suivre la scolarité, informer les familles (notes, absences, paiements, messages) et envoyer les notifications que vous avez acceptées.",
        ],
      },
      {
        title: "Qui peut les voir",
        paragraphs: [
          "Chaque personne ne voit que ce qui la concerne : un parent voit ses enfants, un enseignant ses classes, la direction son école. Les écoles ne voient jamais les données des autres écoles.",
          "Prestataires techniques : l'hébergement (Render, serveurs en Allemagne), l'envoi de SMS si l'école l'active, et, pour l'atelier de préparation de cours réservé aux enseignants, le service d'intelligence artificielle d'Anthropic, qui reçoit uniquement la demande de l'enseignant (matière, niveau, thème) et aucune donnée d'élève.",
        ],
      },
      {
        title: "Combien de temps",
        paragraphs: [
          "Les données sont conservées tant que l'élève ou le membre du personnel est inscrit à l'école, puis le temps nécessaire aux obligations de l'école (archives scolaires et comptables). Les sessions de connexion expirent automatiquement.",
        ],
      },
      {
        title: "Sécurité",
        paragraphs: [
          "Les échanges sont chiffrés (HTTPS), les mots de passe sont stockés sous forme chiffrée, et la base de données n'est accessible que depuis nos serveurs. Des sauvegardes sont faites automatiquement.",
        ],
      },
      {
        title: "Vos droits",
        paragraphs: [
          "Vous pouvez demander à consulter, corriger ou supprimer vos données, ou celles de votre enfant mineur. Ces demandes passent par l'administration de votre école, qui gère les comptes. Voir aussi la page « Supprimer mon compte ».",
        ],
      },
    ],
    deletion: [
      {
        title: "Comment demander la suppression",
        paragraphs: [
          "Les comptes sont créés par l'école. Pour supprimer votre compte (parent, élève ou enseignant) et les données associées, contactez l'administration de votre école, ou écrivez-nous à l'adresse ci-dessous en indiquant le nom de l'école et le téléphone ou l'e-mail de votre compte.",
          "Nous confirmons la demande auprès de l'école puis supprimons le compte sous 30 jours.",
        ],
      },
      {
        title: "Ce qui est supprimé, ce qui est gardé",
        paragraphs: [
          "Supprimés : votre accès, vos coordonnées, vos messages, vos préférences et vos abonnements aux notifications.",
          "Conservés par l'école si la loi l'y oblige : les bulletins, les absences et les paiements de l'élève, qui font partie des archives scolaires et comptables de l'école.",
        ],
      },
    ],
  },
  ar: {
    privacyTitle: "سياسة الخصوصية",
    deletionTitle: "حذف حسابي",
    updated: "آخر تحديث",
    privacyLink: "الخصوصية",
    deletionLink: "حذف حسابي",
    back: "العودة إلى تسجيل الدخول",
    contactLine: (email) =>
      email
        ? `لأي سؤال حول بياناتك، راسلنا على ${email} أو اتصل بإدارة مدرستك.`
        : "لأي سؤال حول بياناتك، اتصل بإدارة مدرستك.",
    privacy: [
      {
        title: "من نحن",
        paragraphs: [
          "منصة المدرسة خدمة لتسيير المدارس الخاصة. كل مدرسة مسؤولة عن بيانات تلاميذها وأوليائهم وموظفيها. ناشر المنصة (Abroudtech) يستضيف هذه البيانات ويعالجها لحساب المدرسة، فقط لتشغيل الخدمة.",
        ],
      },
      {
        title: "البيانات التي نعالجها",
        paragraphs: [
          "الهوية والاتصال: الاسم واللقب (بالفرنسية والعربية)، تاريخ ومكان ولادة التلاميذ، هاتف وبريد وواتساب الأولياء والموظفين.",
          "الحياة المدرسية: الأقسام، جداول الأوقات، الأعداد، الملاحظات، بطاقات الأعداد، الغيابات ومبرراتها، الواجبات، الرسائل مع المدرسة، الإعلانات، ونتائج الألعاب التعليمية.",
          "الدفعات: معاليم الدراسة، الدفعات التي تسجلها المدرسة والوصولات. لا يتم إدخال أي بطاقة بنكية في التطبيق.",
          "بيانات تقنية: ملف تعريف ارتباط ضروري لتسجيل الدخول، سجل محاولات الدخول لمنع التجاوزات، وعنوان جهازك التقني لتلقي الإشعارات إذا قبلتها.",
          "لا نستعمل أي إشهار أو أداة تتبع تجارية، ولا نبيع أي بيانات.",
        ],
      },
      {
        title: "لماذا نستعملها",
        paragraphs: [
          "فقط لسير عمل المدرسة: متابعة الدراسة، إعلام العائلات (الأعداد، الغيابات، الدفعات، الرسائل) وإرسال الإشعارات التي قبلتها.",
        ],
      },
      {
        title: "من يمكنه رؤيتها",
        paragraphs: [
          "كل شخص يرى ما يخصه فقط: الولي يرى أبناءه، المعلم أقسامه، والإدارة مدرستها. لا ترى أي مدرسة بيانات مدرسة أخرى.",
          "مزودو الخدمات التقنية: الاستضافة (Render، خوادم في ألمانيا)، إرسال الرسائل القصيرة إذا فعّلته المدرسة، وخدمة الذكاء الاصطناعي من Anthropic في ورشة إعداد الدروس الخاصة بالمعلمين، والتي تتلقى فقط طلب المعلم (المادة، المستوى، الموضوع) دون أي بيانات عن التلاميذ.",
        ],
      },
      {
        title: "مدة الحفظ",
        paragraphs: [
          "تُحفظ البيانات طوال تسجيل التلميذ أو الموظف بالمدرسة، ثم المدة اللازمة لالتزامات المدرسة (الأرشيف المدرسي والمحاسبي). تنتهي جلسات الدخول تلقائياً.",
        ],
      },
      {
        title: "الأمان",
        paragraphs: [
          "الاتصالات مشفرة (HTTPS)، كلمات المرور محفوظة بشكل مشفر، وقاعدة البيانات لا يمكن الوصول إليها إلا من خوادمنا. تُجرى نسخ احتياطية تلقائياً.",
        ],
      },
      {
        title: "حقوقك",
        paragraphs: [
          "يمكنك طلب الاطلاع على بياناتك أو بيانات طفلك القاصر أو تصحيحها أو حذفها. تمر هذه الطلبات عبر إدارة مدرستك التي تسيّر الحسابات. انظر أيضاً صفحة « حذف حسابي ».",
        ],
      },
    ],
    deletion: [
      {
        title: "كيف تطلب الحذف",
        paragraphs: [
          "الحسابات تنشئها المدرسة. لحذف حسابك (ولي، تلميذ أو معلم) والبيانات المرتبطة به، اتصل بإدارة مدرستك أو راسلنا على العنوان أسفله مع ذكر اسم المدرسة وهاتف أو بريد حسابك.",
          "نتأكد من الطلب مع المدرسة ثم نحذف الحساب في أجل 30 يوماً.",
        ],
      },
      {
        title: "ما يُحذف وما يُحفظ",
        paragraphs: [
          "يُحذف: دخولك، بيانات الاتصال بك، رسائلك، تفضيلاتك واشتراكاتك في الإشعارات.",
          "تحتفظ به المدرسة إذا ألزمها القانون: بطاقات الأعداد والغيابات ودفعات التلميذ، لأنها جزء من الأرشيف المدرسي والمحاسبي.",
        ],
      },
    ],
  },
};
