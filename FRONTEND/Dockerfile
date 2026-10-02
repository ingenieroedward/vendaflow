# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Argumento para la URL del API (se inyecta en tiempo de build de Vite)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .

# CI: typecheck + tests en el build — si fallan, el deploy se aborta
RUN npm run typecheck
RUN npm test

RUN npm run build

# ── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:alpine

# Copiar build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar service worker y assets públicos
COPY --from=builder /app/public /usr/share/nginx/html

# Configuración nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
