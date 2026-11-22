import type { MetadataRoute } from "next";

/** L'application s'installe sur l'écran d'accueil du téléphone, comme une vraie app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "École — Plateforme scolaire",
    short_name: "École",
    description: "Notes, absences, paiements et messages de l'école.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#14213d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
