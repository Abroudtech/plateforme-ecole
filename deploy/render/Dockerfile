# Image pour l'hébergement géré Render (voir render.yaml et docs/DEPLOIEMENT.md).
# Contrairement à l'image "app" du Dockerfile principal, elle garde les outils
# (Prisma, tsx) : la base est mise à jour à chaque démarrage, et la commande
# de création de l'école peut être lancée depuis l'onglet « Shell » de Render.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Le dossier "public" peut être vide (et donc absent du dépôt).
RUN mkdir -p public && npm run build \
 && cp -r .next/static .next/standalone/.next/static \
 && cp -r public .next/standalone/public
ENV NODE_ENV=production PORT=10000 HOSTNAME=0.0.0.0
EXPOSE 10000
CMD ["sh", "-c", "npx prisma migrate deploy && node .next/standalone/server.js"]
