#!/bin/sh
set -e

# Only sync the Prisma schema automatically when explicitly opted in (docker-compose.yml
# sets this for the bundled local Postgres). Left off by default so pointing this image
# at an external database (e.g. production Supabase) never silently alters its schema.
if [ "$RUN_DB_PUSH" = "true" ]; then
    echo "[entrypoint] RUN_DB_PUSH=true — syncing Prisma schema to the database..."
    npx prisma db push --skip-generate
fi

echo "[entrypoint] Starting MediCare..."
exec "$@"
