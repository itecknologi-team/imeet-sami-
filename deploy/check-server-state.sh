#!/usr/bin/env bash
# Read-only diagnostic — checks what's already in place on the deploy host
# before the one-time setup in deploy/DEPLOYMENT.md section 2 is run. Makes
# no changes. Run this on 192.168.20.141 itself:
#
#   bash deploy/check-server-state.sh
#
# (or paste it directly into an SSH session if you don't have the repo
# checked out there yet)

set -uo pipefail

ok()   { printf '  [ok]   %s\n' "$1"; }
miss() { printf '  [MISSING] %s\n' "$1"; }
info() { printf '  [info] %s\n' "$1"; }

echo "== Docker =="
if command -v docker >/dev/null 2>&1; then
  ok "docker: $(docker --version)"
  docker compose version >/dev/null 2>&1 && ok "docker compose: $(docker compose version --short 2>/dev/null)" || miss "docker compose plugin"
else
  miss "docker (required: 24+)"
fi

echo
echo "== Server-side secrets file (/opt/imeet-sami/.env) =="
if [ -f /opt/imeet-sami/.env ]; then
  ok "/opt/imeet-sami/.env exists"
  if grep -q "CHANGE_ME" /opt/imeet-sami/.env 2>/dev/null; then
    miss "contains CHANGE_ME placeholders — needs filling in"
  else
    ok "no CHANGE_ME placeholders left"
  fi
  perm=$(stat -c '%a' /opt/imeet-sami/.env 2>/dev/null || stat -f '%Lp' /opt/imeet-sami/.env 2>/dev/null)
  [ "$perm" = "600" ] && ok "permissions are 600" || info "permissions are $perm (expected 600)"
else
  miss "/opt/imeet-sami/.env (copy from deploy/.env.production.example, fill in, chmod 600)"
fi

echo
echo "== GitHub Actions self-hosted runner =="
if [ -d /opt/actions-runner ] || [ -d "$HOME/actions-runner" ]; then
  RUNNER_DIR=$([ -d /opt/actions-runner ] && echo /opt/actions-runner || echo "$HOME/actions-runner")
  ok "runner directory found at $RUNNER_DIR"
  if systemctl list-units --full -all 2>/dev/null | grep -qi "actions.runner"; then
    ok "runner is registered as a systemd service:"
    systemctl list-units --full -all 2>/dev/null | grep -i "actions.runner" | sed 's/^/         /'
    svc=$(systemctl list-units --full -all 2>/dev/null | grep -i "actions.runner" | awk '{print $1}' | head -1)
    [ -n "$svc" ] && systemctl is-active "$svc" >/dev/null 2>&1 && ok "service is active" || info "service exists but may not be active — check: systemctl status $svc"
  else
    miss "no actions-runner systemd service found — installed but not run as a service? (./svc.sh install && ./svc.sh start)"
  fi
else
  miss "no GitHub Actions runner found (neither /opt/actions-runner nor ~/actions-runner)"
fi

echo
echo "== Docker group membership (runner user must be in it) =="
if groups "$USER" 2>/dev/null | grep -qw docker; then
  ok "$USER is in the docker group"
else
  miss "$USER is NOT in the docker group (sudo usermod -aG docker \$USER, then re-login)"
fi

echo
echo "== Existing imeet-sami containers =="
if docker compose -p imeet-sami ps --format json >/dev/null 2>&1; then
  count=$(docker ps --filter "label=com.docker.compose.project=imeet-sami" --format '{{.Names}}' 2>/dev/null | wc -l)
  if [ "$count" -gt 0 ]; then
    ok "imeet-sami project has $count container(s) already running:"
    docker ps --filter "label=com.docker.compose.project=imeet-sami" --format '  {{.Names}}: {{.Status}}'
  else
    info "no imeet-sami containers currently running (fine if this is the first deploy)"
  fi
else
  info "docker not available or no permission to query — skipped"
fi

echo
echo "== Caddy =="
if docker ps --format '{{.Names}}\t{{.Image}}' 2>/dev/null | grep -qi caddy; then
  info "Caddy is CONTAINERIZED — see DEPLOYMENT.md 2.4 for the network-attach step"
  docker ps --format '  {{.Names}}\t{{.Image}}' | grep -i caddy
elif command -v caddy >/dev/null 2>&1; then
  ok "Caddy is a host service: $(caddy version 2>/dev/null)"
  if [ -f /etc/caddy/Caddyfile ] && grep -q "imeet.itecknologi.com" /etc/caddy/Caddyfile 2>/dev/null; then
    ok "Caddyfile already has an imeet.itecknologi.com site block"
  else
    miss "Caddyfile has no imeet.itecknologi.com block yet (append deploy/Caddyfile.snippet)"
  fi
else
  miss "no Caddy found (host service or container)"
fi

echo
echo "== Firewall (media ports) =="
if command -v ufw >/dev/null 2>&1; then
  ufw status 2>/dev/null | grep -E "50100:50199/udp|7882" && ok "media ports appear open" || miss "50100:50199/udp and 7882/tcp not found in ufw status"
else
  info "ufw not found — check your firewall's rules manually for 50100-50199/udp and 7882/tcp"
fi

echo
echo "== Done. Paste this whole output back for next steps. =="
