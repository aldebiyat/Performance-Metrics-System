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
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY backend/package*.json ./
COPY backend/src/config/schema.sql ./src/config/
COPY backend/src/data/data.csv ./src/data/
EXPOSE 5001
CMD ["node", "dist/index.js"]
