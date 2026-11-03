#!/bin/sh

# Applies schema AND the baseline migration's RLS policies before starting the app.
# Fail fast: an app without tables (or without RLS) must not start.

echo "Running Prisma Migrate Deploy..."
if ! npx prisma migrate deploy --schema=prisma/schema.prisma; then
  echo "FATAL: prisma migrate deploy failed — check DATABASE_URL / network from container"
  exit 1
fi

echo "Starting Next.js..."
exec node server.js