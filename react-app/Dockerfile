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

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy built files
COPY --from=builder /app/build .
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Change ownership and permissions for non-root nginx
RUN chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    chown -R appuser:appgroup /etc/nginx/conf.d && \
    chown -R appuser:appgroup /etc/nginx/templates && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid

# Default CSP connect-src for production (no localhost)
ENV CSP_CONNECT_SRC="http://pms-backend:3200"

# Switch to non-root user
USER appuser

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

# Run envsubst to substitute environment variables, then start nginx
CMD ["/bin/sh", "-c", "envsubst '${CSP_CONNECT_SRC}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]

# Stage 4: Development
FROM node:20-alpine AS development
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Create non-root user for security (same as production)
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Development uses React dev server
ARG PORT=3201
ENV PORT=${PORT}

EXPOSE ${PORT}

CMD ["sh", "-c", "npm start"]
