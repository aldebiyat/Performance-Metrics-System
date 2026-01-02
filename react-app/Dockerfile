# ============================================
# Frontend Dockerfile - Multi-stage build (React/CRA)
# ============================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for environment variables
ARG REACT_APP_API_URL
ARG REACT_APP_SENTRY_DSN

ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_SENTRY_DSN=${REACT_APP_SENTRY_DSN}
ENV CI=true

RUN npm run build

# Stage 3: Production (Nginx)
FROM nginx:alpine AS production
WORKDIR /usr/share/nginx/html

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy built files
COPY --from=builder /app/build .
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Change ownership and permissions for non-root nginx
RUN chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid

# Switch to non-root user
USER appuser

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]

# Stage 4: Development
FROM node:20-alpine AS development
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

# Development uses React dev server
ARG PORT=3201
ENV PORT=${PORT}

EXPOSE ${PORT}

CMD ["sh", "-c", "npm start"]
