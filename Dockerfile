# Prisma 7 requires node ^20.19 || ^22.12 || >=24
# Debian (glibc) instead of alpine: puppeteer PDF generation needs a Chrome build
# that matches its CDP protocol. Alpine's chromium package (136) is too old for
# puppeteer 24 and the CDP handshake intermittently hangs. On glibc we can use
# puppeteer's own chrome-headless-shell download, which is always version-matched.
FROM node:22.13-slim AS base
# Install dependencies only when needed
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Install dependencies based on the preferred package manager
# .npmrc (legacy-peer-deps=true) must ship with the lockfile or npm ci enforces
# next-auth's nodemailer ^7 peer against our nodemailer@10 and hard-fails.
COPY package.json package-lock.json* .npmrc ./
RUN npm ci
# Download the version-matched headless shell into the build cache; the runner
# stage copies it so no postinstall download happens at runtime.
RUN npx puppeteer browsers install chrome-headless-shell
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
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
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
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
        # chrome-headless-shell runtime libs (Debian bookworm)
        libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
        libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
        libcairo2 libatspi2.0-0 \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# Next.js telemetry is disabled during runtime
ENV NEXT_TELEMETRY_DISABLED=1
# No browser download at runtime; the deps-stage build below provides it
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs
# chrome-headless-shell installed in the deps stage; version-matched to puppeteer,
# so its CDP protocol is exactly what puppeteer is built against. Puppeteer finds it
# automatically in the default cache dir (~/.cache/puppeteer).
COPY --from=deps --chown=nextjs:nodejs /root/.cache/puppeteer /home/nextjs/.cache/puppeteer
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
# adduser --system gives no home dir; puppeteer resolves its cache from $HOME
ENV HOME=/home/nextjs
EXPOSE 3000
ENV PORT=3000
# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["./entrypoint.sh"]
