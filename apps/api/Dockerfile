# Build từ thư mục gốc repository: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/api

FROM deps AS build
COPY apps/api ./apps/api
RUN npm run build --workspace apps/api

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/api --omit=dev && npm cache clean --force
COPY --from=build /app/apps/api/dist ./apps/api/dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:${PORT:-3001}/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
