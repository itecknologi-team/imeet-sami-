#!/usr/bin/env bash
#
# Deploy imeet without the CI/CD pipeline.
#
# Run this ON the deployment host (192.168.20.141), from the root of the repo
# checkout. It does exactly what .github/workflows/deploy.yml does, minus the
# GitHub runner: build, migrate, start, verify.
#
# Safe to re-run — it's the normal way to deploy a new revision, not just a
# first-time bootstrap. Named volumes and the fixed compose project name mean
# your data survives across runs.
#
#   ./deploy/manual-deploy.sh
#
# Options:
#   --skip-migrations   Don't apply pending database migrations.
#   --env-file PATH     Secrets file (default: /opt/imeet-sami/.env).

set -euo pipefail

ENV_FILE="/opt/imeet-sami/.env"
COMPOSE_FILE="docker-compose.prod.yml"
RUN_MIGRATIONS=1

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-migrations) RUN_MIGRATIONS=0; shift ;;
    --env-file) ENV_FILE="${2:?--env-file needs a path}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- preflight
step "Checking prerequisites"

[ -f "$COMPOSE_FILE" ] || fail "$COMPOSE_FILE not found. Run this from the repo root."
command -v docker >/dev/null || fail "docker is not installed."
docker compose version >/dev/null 2>&1 || fail "the docker compose plugin is not installed."
docker info >/dev/null 2>&1 || fail "cannot talk to the docker daemon. Is it running, and is your user in the 'docker' group?"

[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found.
  Create it from deploy/.env.production.example:
    sudo mkdir -p \"\$(dirname "$ENV_FILE")\"
    cp deploy/.env.production.example \"$ENV_FILE\"
    chmod 600 \"$ENV_FILE\"
  then fill in every CHANGE_ME value."

# Catches the most common half-finished setup before anything is touched,
# rather than after the stack is already partly restarted.
if grep -q "CHANGE_ME" "$ENV_FILE"; then
  fail "$ENV_FILE still contains CHANGE_ME placeholders. Generate each secret separately:
    for k in POSTGRES_PASSWORD JWT_SECRET LIVEKIT_API_SECRET MINIO_ROOT_PASSWORD; do
      echo \"\$k=\$(openssl rand -hex 32)\"
    done"
fi

# The file holds every credential the stack has.
perms="$(stat -c '%a' "$ENV_FILE")"
[ "$perms" = "600" ] || echo "  note: $ENV_FILE is mode $perms — consider 'chmod 600 $ENV_FILE'"

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

compose config >/dev/null || fail "compose configuration is invalid — see the error above."
echo "  prerequisites OK"

PUBLIC_ORIGIN="$(grep -E '^PUBLIC_ORIGIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"

# ------------------------------------------------------------------- build
step "Building images (first run pulls base images — this takes a few minutes)"
compose build

# --------------------------------------------------------------- datastores
step "Starting postgres, redis and minio"
# Migrations need a reachable database; --wait blocks on the healthchecks
# rather than racing them.
compose up -d --wait postgres redis minio

step "Ensuring the storage bucket exists"
# Run synchronously (and kept out of the default service set via its compose
# profile) because it's a one-shot that exits — `up --wait` counts an exited
# container as a failure regardless of its exit code.
compose --profile init run --rm minio-init

# -------------------------------------------------------------- migrations
if [ "$RUN_MIGRATIONS" = "1" ]; then
  step "Applying database migrations"
  # Idempotent: already-applied files are tracked in schema_migrations and
  # each runs in its own transaction.
  compose run --rm --no-deps backend npm run migrate:prod
else
  step "Skipping migrations (--skip-migrations)"
fi

# ------------------------------------------------------------------- start
step "Starting the full stack"
# A container that boots and immediately crashes fails here instead of
# restart-looping unnoticed.
compose up -d --wait --remove-orphans

# ------------------------------------------------------------------ verify
step "Verifying the backend"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:4100/api/health 2>/dev/null | grep -q '"status":"ok"'; then
    ok=1; break
  fi
  sleep 1
done
if [ "$ok" != "1" ]; then
  echo
  compose ps || true
  echo
  compose logs --tail=60 backend || true
  fail "backend did not become healthy within 30s (logs above)."
fi
echo "  backend healthy on 127.0.0.1:4100"

step "Verifying the public URL through Caddy"
# Checks the whole path — TLS, Caddy routing, the app. A failure here while the
# backend is healthy above means the reverse proxy config is what's wrong, not
# the deploy.
if curl -fsS --max-time 15 "$PUBLIC_ORIGIN/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
  echo "  $PUBLIC_ORIGIN is serving"
else
  echo
  echo "  WARNING: $PUBLIC_ORIGIN/api/health did not respond."
  echo "  The stack itself is up and healthy — this is the reverse proxy layer."
  echo "  Check:"
  echo "    * the site block from deploy/Caddyfile.snippet is in the Caddyfile"
  echo "    * 'docker ps | grep -i caddy' — if Caddy is containerized, the"
  echo "      127.0.0.1 upstreams can't work; see the note atop the snippet"
  echo "    * sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy"
fi

# ------------------------------------------------------------------ finish
step "Deployed"
compose ps
git rev-parse HEAD 2>/dev/null | sed 's/^/  revision: /' || true

cat <<EOF

  Reminder — WebRTC media does NOT go through Caddy. If meetings connect but
  nobody can see or hear anyone, these ports are the cause:
    sudo ufw allow 50100:50199/udp
    sudo ufw allow 7882/tcp

  Logs:    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f backend
  Restart: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE restart backend
EOF
