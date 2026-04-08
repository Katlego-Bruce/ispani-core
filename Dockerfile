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

# Security: run as non-root
RUN addgroup -g 1001 -S ispani && \
    adduser -S ispani -u 1001 -G ispani

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
COPY src ./src

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

USER ispani

EXPOSE 3000

CMD ["node", "src/server.js"]
