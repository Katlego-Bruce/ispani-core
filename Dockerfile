# ─── Build Stage ───────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

# ─── Production Stage ──────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install OpenSSL (required by Prisma)
RUN apk add --no-cache openssl

# Security: run as non-root
RUN addgroup -g 1001 -S ispani && \
    adduser -S ispani -u 1001 -G ispani

# Copy with correct ownership so ispani user can write to prisma engines
COPY --from=builder --chown=ispani:ispani /app/node_modules ./node_modules
COPY --from=builder --chown=ispani:ispani /app/prisma ./prisma
COPY --chown=ispani:ispani package*.json ./
COPY --chown=ispani:ispani src ./src

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

USER ispani

EXPOSE 3000

CMD ["node", "src/server.js"]
