# Multi-stage: the build stage needs typescript + devDependencies, the final
# image must not ship them (smaller image, smaller attack surface).
FROM node:22-alpine AS build

WORKDIR /app

# `npm ci` (not `npm install`) so the lockfile is authoritative — an install
# resolves fresh versions at build time, which makes builds non-reproducible
# and can silently pull a different transitive dependency than the one that
# was tested.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build


FROM node:22-alpine AS runtime

# dumb-init reaps zombies and, more importantly, forwards SIGTERM to node so
# the graceful-shutdown handler in server.ts actually runs on redeploy. PID 1
# in a container otherwise ignores default signal dispositions.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
# Migrations are plain .sql read at runtime by dist/db/migrate.js, so they are
# not part of the TypeScript build output and have to be copied explicitly.
COPY src/db/migrations ./dist/db/migrations

# Run as an unprivileged user: a compromise in the app then can't modify its
# own code or the rest of the filesystem. The node image ships a `node` user
# (uid 1000) for exactly this.
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
