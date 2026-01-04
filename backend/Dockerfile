# ============================================
# Backend Dockerfile - Multi-stage build (Express.js)
# ============================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Copy package files and install production dependencies only
COPY package.json package-lock.json* ./
RUN apk add --no-cache libc6-compat python3 make g++ && \
    npm ci --only=production && \
    apk del python3 make g++

# Copy built application and required files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY src/config/schema.sql ./src/config/
COPY src/data/data.csv ./src/data/

# Create directories and set permissions
RUN mkdir -p uploads logs && \
    chown -R expressjs:nodejs /app

# Switch to non-root user
USER expressjs

EXPOSE ${PORT:-3200}

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3200}/api/health || exit 1

CMD ["sh", "-c", "npm run migrate:up && node dist/index.js"]

# Stage 4: Development
FROM node:20-alpine AS development
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++

# Create non-root user for security (same as production)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

# Set ownership
RUN chown -R expressjs:nodejs /app

# Switch to non-root user
USER expressjs

EXPOSE ${PORT:-3200}

CMD ["sh", "-c", "npm run migrate:up && npm run dev"]
