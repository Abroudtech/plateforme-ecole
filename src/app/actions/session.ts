"use server";

import { redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getOptionalContext } from "@/lib/auth/context";
import { destroySession, setActiveSchool } from "@/lib/auth/session";

function safeLang(lang: string) {
  return isLocale(lang) ? lang : "fr";
}

export async function logout(lang: string) {
  await destroySession();
  redirect(`/${safeLang(lang)}/connexion`);
}

/** Change d'établissement (pour un compte rattaché à plusieurs écoles). */
export async function switchSchool(lang: string, formData: FormData) {
  const ctx = await getOptionalContext();
  const schoolId = String(formData.get("schoolId") ?? "");
  // On vérifie que le compte a bien accès à cette école.
  if (ctx && ctx.schools.some((s) => s.id === schoolId)) {
    await setActiveSchool(ctx.session.id, schoolId);
  }
  redirect(`/${safeLang(lang)}/tableau-de-bord`);
}
