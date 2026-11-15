# Build từ thư mục gốc repository: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Cần schema trước npm ci vì postinstall chạy "prisma generate"
COPY apps/api/prisma apps/api/prisma
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
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace apps/api --omit=dev && npm cache clean --force
COPY --from=build /app/apps/api/dist ./apps/api/dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:${PORT:-3001}/health || exit 1
# Áp migration an toàn (chỉ chạy migration chưa áp) rồi khởi động API (ADR 003, ADR 007)
WORKDIR /app/apps/api
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
