#!/bin/sh

# Applies schema AND the baseline migration's RLS policies before starting the app.
# Fail fast: an app without tables (or without RLS) must not start.
#
# The Prisma CLI is installed into ./.prisma-cli (see Dockerfile) because Prisma 7's CLI needs its
# full dependency tree, which the Next.js standalone output does not contain. Do NOT switch this
# back to `npx prisma`: standalone images ship no node_modules/.bin, so npx fails with
# "sh: prisma: not found" and buries the real cause.

PRISMA_BIN="./.prisma-cli/node_modules/.bin/prisma"
if [ ! -x "$PRISMA_BIN" ]; then
  echo "FATAL: Prisma CLI missing at $PRISMA_BIN — image built without the prisma-cli stage"
  exit 1
fi

echo "Running Prisma Migrate Deploy..."
if ! "$PRISMA_BIN" migrate deploy --schema=prisma/schema.prisma; then
  echo "FATAL: prisma migrate deploy failed — see the Prisma error above"
  echo "  hint: DATABASE_URL comes from prisma.config.ts + container env; also check DB host/port reachability"
  exit 1
fi

echo "Starting Next.js..."
exec node server.js
