# Etapa 1: instala dependencias de producción
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Etapa 2: imagen final, mínima y sin privilegios de root
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000

ARG APP_VERSION=local
ARG BUILD_TIME=desconocida
ENV APP_VERSION=${APP_VERSION} BUILD_TIME=${BUILD_TIME}

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "src/server.js"]
