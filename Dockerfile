# Prisma 7 requires node ^20.19 || ^22.12 || >=24
FROM node:22.12-alpine AS base

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

# IMPORTANT: Copy the Prisma schema and migrations so we can run `db push` or migrations in production
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Prisma CLI + engines are NOT part of standalone output — needed by entrypoint to run migrations
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# We also need the entrypoint script
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["./entrypoint.sh"]
