#!/bin/sh
# Sauvegarde de la base de données (à lancer chaque nuit, par exemple avec cron) :
#   0 2 * * * /chemin/vers/deploy/sauvegarde.sh
# Garde les 30 dernières sauvegardes dans deploy/sauvegardes/.
set -eu
cd "$(dirname "$0")"
mkdir -p sauvegardes
FICHIER="sauvegardes/ecole-$(date +%Y-%m-%d-%H%M).sql.gz"
docker compose exec -T db pg_dump -U ecole ecole | gzip > "$FICHIER"
ls -1t sauvegardes/*.sql.gz | tail -n +31 | xargs -r rm --
echo "Sauvegarde : $FICHIER"
