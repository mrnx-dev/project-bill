# Prisma 7 requires node ^20.19 || ^22.12 || >=24
FROM node:22.13-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client BEFORE building Next.js
RUN npx prisma generate

# Next.js telemetry is disabled during the build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the project
RUN npm run build

# The Prisma CLI is not self-contained anymore: since v7 it loads @prisma/dev, which pulls
# ~17 transitive packages (valibot, hono, remeda, ...). The Next.js standalone output ships no
# node_modules/.bin and only traced packages, so installing the CLI there is impossible.
# Install it (plus dotenv, needed by prisma.config.ts) in an isolated prefix instead.
FROM base AS prisma-cli
RUN apk add --no-cache openssl
WORKDIR /cli
RUN printf '{"name":"prisma-cli","private":true}' > package.json \
 && npm install prisma@7.5.0 dotenv@17.3.1 --no-fund --no-audit --no-package-lock \
 && rm -rf node_modules/@electric-sql node_modules/@prisma/studio-core \
           node_modules/react-dom node_modules/react node_modules/lodash \
           node_modules/hono node_modules/chevrotain
# ^ This image only ever runs `prisma migrate deploy` / `migrate status`. Those never touch the local
#   pglite dev server (@electric-sql), Prisma Studio and its react tree, lodash, hono or chevrotain —
#   dropping them saves ~80MB. Do NOT remove fast-check or effect: @prisma/dev requires them at load
#   time and the CLI dies with "Cannot find module" without them. Re-verify with migrate deploy on a
#   throwaway database before pruning anything else.

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Ensure required system packages are installed
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
# Next.js telemetry is disabled during runtime
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy over the built files
# public/ may not exist in the repo; use a wildcard so COPY never fails
COPY --from=builder /app/public* ./

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# SECURITY: the build context contains the `.env` Dokploy generates (needed by `next build`,
# see .dockerignore), and Next copies it into the standalone output. Runtime configuration comes
# from the container environment, so the file must not ship: otherwise AUTH_SECRET, ENCRYPTION_KEY,
# database credentials and API keys end up baked into every image that is built or pushed.
RUN rm -f .env .env.local .env.production .env.development .env.test

# IMPORTANT: Copy the Prisma schema and migrations so we can run `db push` or migrations in production
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# App runtime Prisma packages (generated client, adapter-pg, engines) — Next traces some of these,
# but the builder copy is the authoritative generated output.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# Prisma 7 reads the datasource URL from prisma.config.ts — it is NOT part of the standalone output
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
# Migration CLI lives in its own prefix (see prisma-cli stage). prisma.config.ts does
# `import "prisma/config"` and `import "dotenv/config"`, which resolve from /app — so expose those
# two packages through symlinks. Node resolves the realpath, so the CLI's own deps still come
# from .prisma-cli/node_modules instead of the (incomplete) standalone tree.
COPY --from=prisma-cli /cli/node_modules /app/.prisma-cli/node_modules
RUN rm -rf ./node_modules/prisma \
 && ln -s /app/.prisma-cli/node_modules/prisma ./node_modules/prisma \
 && ln -s /app/.prisma-cli/node_modules/dotenv ./node_modules/dotenv
# We also need the entrypoint script
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["./entrypoint.sh"]
