import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";

/**
 * Toutes les adresses commencent par la langue : /fr/... ou /ar/...
 * Si quelqu'un arrive sans langue (par ex. "/"), on l'envoie vers la langue
 * qu'il a choisie la dernière fois, sinon celle de son navigateur.
 */
function preferredLocale(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const accept = request.headers.get("accept-language") ?? "";
  const languages = accept
    .split(",")
    .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase());
  return languages.find((l): l is Locale => isLocale(l)) ?? defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];

  if (isLocale(first)) {
    // Mémorise la langue utilisée pour la prochaine visite.
    const response = NextResponse.next();
    if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
      response.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    return response;
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Ignore les fichiers techniques (_next, images, favicon...).
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
