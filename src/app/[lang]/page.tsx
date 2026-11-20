import { redirect } from "next/navigation";
import { getOptionalContext } from "@/lib/auth/context";

// Page d'accueil : on envoie vers le tableau de bord si la personne est
// connectée, sinon vers la page de connexion.
export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  const ctx = await getOptionalContext();
  redirect(ctx?.school ? `/${lang}/tableau-de-bord` : `/${lang}/connexion`);
}
