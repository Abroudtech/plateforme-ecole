import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Toutes les pages de l'application dépendent de la personne connectée :
  // on garde un rendu dynamique classique, plus simple à maintenir.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
