FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines import.meta.env at build time, so anything environment-specific
# must be a build arg — it cannot be injected when the container starts.
# Left empty on purpose for the reverse-proxied deployment: the app then talks
# to its own origin and Caddy routes /api + /socket.io to the backend
# (see src/services/api.ts).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


FROM caddy:2-alpine AS runtime

COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 8080
