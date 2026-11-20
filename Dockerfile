# Image de production de la plateforme.
#   docker build -t plateforme-ecole .
# Deux cibles :
#   - "app"   : le site (léger)
#   - "outils": migrations de la base et scripts (création de l'école)

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS outils
COPY . .
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r ecole && useradd -r -g ecole ecole
COPY --from=build --chown=ecole:ecole /app/.next/standalone ./
COPY --from=build --chown=ecole:ecole /app/.next/static ./.next/static
COPY --from=build --chown=ecole:ecole /app/public ./public
USER ecole
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
