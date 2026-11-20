import type { Role } from "@prisma/client";

/**
 * Qui a le droit de faire quoi.
 *
 * Chaque action de l'application correspond à une "permission". Pour ajouter
 * un rôle ou ouvrir un module à un rôle, il suffit de modifier ce tableau.
 * Les rôles TEACHER (V2) et STUDENT (V3) sont déjà prévus.
 */
export const PERMISSIONS = {
  // Tableau de bord de la direction
  "dashboard.admin": ["ADMIN"],
  // Élèves, classes, niveaux
  "students.read": ["ADMIN", "TEACHER"],
  "students.write": ["ADMIN"],
  "classes.read": ["ADMIN", "TEACHER"],
  "classes.write": ["ADMIN"],
  // Notes et bulletins (V1 : saisie par l'administration ; V2 : par les enseignants)
  "grades.read": ["ADMIN", "TEACHER"],
  "grades.write": ["ADMIN"],
  "reportCards.publish": ["ADMIN"],
  // Absences
  "attendance.read": ["ADMIN", "TEACHER"],
  "attendance.write": ["ADMIN"],
  // Paiements des familles
  "payments.read": ["ADMIN"],
  "payments.write": ["ADMIN"],
  // Emplois du temps, enseignants et salles
  "timetable.read": ["ADMIN", "TEACHER"],
  "timetable.write": ["ADMIN"],
  "staff.write": ["ADMIN"],
  // Messagerie
  "messages.send": ["ADMIN", "TEACHER", "PARENT"],
  // Boîte de l'école (toutes les conversations), annonces et alertes SMS
  "messages.school": ["ADMIN"],
  "announcements.write": ["ADMIN"],
  "alerts.manage": ["ADMIN"],
  // Paramètres de l'école (nom, adresse, calcul de la moyenne annuelle)
  "settings.write": ["ADMIN"],
  // Import en masse depuis Excel (classes, enseignants, élèves, parents...)
  "import.write": ["ADMIN"],
  // Espace parent : voir uniquement ses propres enfants
  "children.read": ["PARENT"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/** Vrai si l'un des rôles donnés autorise la permission. */
export function can(roles: readonly Role[], permission: Permission): boolean {
  const allowed: readonly Role[] = PERMISSIONS[permission];
  return roles.some((r) => allowed.includes(r));
}
