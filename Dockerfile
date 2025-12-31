# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy package files and install production dependencies only
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy built application and required files
COPY --from=builder /app/dist ./dist
COPY backend/src/config/schema.sql ./src/config/
COPY backend/src/data/data.csv ./src/data/

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 5001
CMD ["node", "dist/index.js"]
