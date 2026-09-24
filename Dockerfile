# Build the PWA, then serve it with nginx (phone + desktop over any URL).
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/pipeline/package.json packages/pipeline/

RUN npm ci

COPY apps/web apps/web
COPY packages/pipeline packages/pipeline
COPY policies policies

RUN npm run build --workspace=@sa/pipeline \
  && npm run build --workspace=@sa/web

FROM nginx:1.27-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1:8080/ | grep -q Screenshot || exit 1

CMD ["nginx", "-g", "daemon off;"]
