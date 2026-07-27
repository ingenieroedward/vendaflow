# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# python3/make/g++ requeridos para compilar módulos nativos de npm
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

# CI: los tests corren en el build — si fallan, el deploy se aborta
RUN npm test

RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Solo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar build compilado
COPY --from=builder /app/dist ./dist

RUN mkdir -p logs && chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3001

CMD ["npm", "start"]
