# Deploying imeet to imeet.itecknologi.com (192.168.20.141)

This is the one-time server setup, then how the CI/CD pipeline works.

The stack runs as its own docker compose project (`imeet-sami`), on ports that
do not overlap the imeet deployment already on this host. The existing Caddy
gains one new site block; nothing about the current deployment changes.

---

## 1. Why the pipeline is built this way

**192.168.20.141 is a private address.** GitHub's hosted runners are on the
public internet and cannot route to it. A conventional
"`ssh` from the runner into the server" deploy step physically cannot connect
unless SSH is exposed to the internet — which means a permanent inbound attack
surface plus a long-lived private key sitting in GitHub secrets.

So the deploy job runs on a **self-hosted runner installed on the deployment
host itself**. The runner makes an *outbound* connection to GitHub and polls
for work; nothing inbound is opened, and no credential leaves the network.

- `ci.yml` → GitHub-hosted runners. Lint, typecheck, build, audit, image
  builds. Runs on every push and PR. Needs no network access to the server.
- `deploy.yml` → the self-hosted runner. Builds images on the host, migrates,
  restarts, and health-checks.

> If you would rather deploy from a cloud runner, the alternative is to join
> the runner to the network with Tailscale (`tailscale/github-action`) and then
> SSH over the tailnet. That still needs an SSH key in secrets; the self-hosted
> runner avoids it entirely.

---

## 2. One-time server setup

All commands run on **192.168.20.141**.

### 2.1 Prerequisites

```bash
docker --version          # 24+ with the compose plugin
docker compose version
```

### 2.2 Create the deploy directory and secrets file

Kept outside any git checkout so a deploy can never overwrite it:

```bash
sudo mkdir -p /opt/imeet-sami
sudo chown "$USER" /opt/imeet-sami

# Copy the template from the repo, then fill it in.
cp deploy/.env.production.example /opt/imeet-sami/.env
chmod 600 /opt/imeet-sami/.env
```

Generate each secret separately — never reuse one value across two variables:

```bash
for k in POSTGRES_PASSWORD JWT_SECRET LIVEKIT_API_SECRET MINIO_ROOT_PASSWORD; do
  echo "$k=$(openssl rand -hex 32)"
done
```

Paste those in, and confirm `PUBLIC_ORIGIN=https://imeet.itecknologi.com` and
`LIVEKIT_PUBLIC_URL=wss://imeet.itecknologi.com/livekit`.

The backend validates this at boot and **refuses to start** if `JWT_SECRET` is
short, if `ALLOWED_ORIGINS` is unset, if the committed dev LiveKit secret or
the default MinIO credentials are still in place, or if the recordings bucket
would be public. A misconfigured deploy fails loudly instead of running
insecurely.

### 2.3 Install the GitHub Actions runner

Repo → **Settings → Actions → Runners → New self-hosted runner** (Linux x64),
then follow the commands it shows. When it asks for labels, add **`imeet-prod`**
— `deploy.yml` targets `[self-hosted, imeet-prod]`.

Install it as a service so it survives reboots:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

The runner's user must be able to run docker:

```bash
sudo usermod -aG docker "$USER"   # log out and back in, then restart the service
```

### 2.4 Add the Caddy site block

Append `deploy/Caddyfile.snippet` to the existing Caddyfile (usually
`/etc/caddy/Caddyfile`), then:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy issues the TLS certificate automatically, which needs
`imeet.itecknologi.com` to resolve to this host and ports 80/443 reachable for
the ACME challenge.

**Check which kind of Caddy you have first** — it decides the upstream
addresses:

```bash
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i caddy
```

- **Nothing printed** → Caddy is a host service. Use the snippet as written.
- **A container is listed** → Caddy is containerized, and `127.0.0.1:PORT`
  would mean *the Caddy container itself*. The stack's ports are published on
  the host loopback, which a container cannot reach. Attach Caddy to the
  stack's network and address the services by name:

  ```bash
  docker network connect imeet-sami-net <caddy-container-name>
  ```

  then replace the upstreams as listed at the top of the snippet
  (`127.0.0.1:4100` → `backend:4000`, and so on). Add the network to Caddy's
  own compose file so it survives the container being recreated.

### 2.5 Open the media ports

WebRTC media does **not** flow through Caddy — it goes straight to this host.
Without these open, participants connect and then see and hear nothing:

| Port            | Proto | Scope  | Purpose                        |
| --------------- | ----- | ------ | ------------------------------ |
| 443             | TCP   | public | App, API, LiveKit signaling    |
| 50100–50199     | UDP   | public | WebRTC media (primary path)    |
| 7882            | TCP   | public | ICE/TCP fallback               |

```bash
sudo ufw allow 50100:50199/udp
sudo ufw allow 7882/tcp
```

If the host is behind NAT, forward the same ports. If LiveKit then advertises a
private address, set `node_ip` to the public IP in `deploy/livekit.prod.yaml`.

### 2.6 First deploy

No manual clone is needed — the runner checks the code out itself, and the
compose project name is fixed (`imeet-sami`), so the named volumes are the same
set no matter which directory a deploy runs from.

Once 2.2–2.5 are done, run the pipeline: **Actions → Deploy to production →
Run workflow**, leaving "Apply pending database migrations" checked. That first
run builds the images, creates the schema, starts everything, and verifies both
the container and the public URL.

Do the Caddy step (2.4) *before* this run: the workflow's final check fetches
`https://imeet.itecknologi.com/api/health`, which fails if the site block isn't
in place yet.

<details>
<summary>Deploying by hand instead (troubleshooting / no runner)</summary>

```bash
cd /opt && git clone https://github.com/itecknologiteams/imeet-sami-.git
cd imeet-sami-
docker compose -f docker-compose.prod.yml --env-file /opt/imeet-sami/.env up -d --build --wait
docker compose -f docker-compose.prod.yml --env-file /opt/imeet-sami/.env \
  run --rm --no-deps backend npm run migrate:prod
curl -fsS https://imeet.itecknologi.com/api/health
```

</details>

---

## 3. Using the pipeline

### CI (automatic)

Every push and PR to `main` runs `ci.yml`: backend typecheck/build/audit,
frontend lint/build/audit, both container images, and a validation of
`docker-compose.prod.yml`. The frontend build step matters — it catches the
class of failure that only appears in a real production build and never in the
dev server.

### Deploy (manual by default)

**Actions → Deploy to production → Run workflow.**

It is manual on purpose: a video conferencing server should not restart
underneath live meetings because someone merged a README fix. To deploy on
every merge instead, uncomment the `push:` trigger at the top of `deploy.yml`.

The job: verifies the env file → records the current revision → builds images →
starts postgres/redis and waits for health → applies migrations (toggleable) →
starts everything with `--wait` → checks `/api/health` on the container → checks
it again through the public URL → prunes dangling images.

If any step fails it prints container status and recent logs, and names the
previous revision for rollback. Because `--wait` gates on healthchecks, a
container that boots and crash-loops fails the deploy rather than silently
restarting forever.

**Recommended:** Settings → Environments → `production` → require a reviewer,
so each deploy needs an approval click.

### Rollback

```bash
cd /opt/imeet-sami-
git checkout <previous-sha>
docker compose -f docker-compose.prod.yml --env-file /opt/imeet-sami/.env up -d --build --wait
```

Migrations are forward-only — they are not reversed by a rollback. Check
whether the newer revision added any before rolling back across one.

---

## 4. Operations

```bash
cd /opt/imeet-sami-
export EF=/opt/imeet-sami/.env

docker compose -f docker-compose.prod.yml --env-file $EF ps
docker compose -f docker-compose.prod.yml --env-file $EF logs -f backend
docker compose -f docker-compose.prod.yml --env-file $EF restart backend
```

**Database backup** (nothing schedules this yet — see the open items below):

```bash
docker compose -f docker-compose.prod.yml --env-file $EF exec -T postgres \
  pg_dump -U imeet imeet | gzip > "imeet-$(date +%F).sql.gz"
```

### Ports in use by this stack

| Service   | Host binding          | Notes                          |
| --------- | --------------------- | ------------------------------ |
| frontend  | `127.0.0.1:8081`      | via Caddy                      |
| backend   | `127.0.0.1:4100`      | via Caddy (`/api`, `/socket.io`)|
| livekit   | `127.0.0.1:7890`      | signaling, via Caddy (`/livekit`)|
| livekit   | `7882/tcp`, `50100-50199/udp` | public — media          |
| minio     | `127.0.0.1:9010`      | via Caddy (`/imeet-media`)     |
| minio     | `127.0.0.1:9011`      | console, never exposed         |
| postgres  | *(none)*              | internal only                  |
| redis     | *(none)*              | internal only                  |

---

## 5. Known limitations

Worth deciding on before this carries real traffic:

- **No automated backups.** Postgres and MinIO hold all meeting data on local
  volumes. Add a scheduled `pg_dump` + `mc mirror` to off-host storage.
- **Single host, no redundancy.** Any restart drops live meetings.
- **Meeting recap/recordings listings are reachable by meeting code alone.**
  This matches the app's existing model (the code is the capability to join at
  all), and objects are now private and served via short-lived signed URLs —
  but the listing itself is not additionally access-controlled.
- **Meeting passcodes are stored in plaintext** in the `meetings` table. The
  comparison is constant-time now, but anyone with database access can read
  them.
- **No error tracking or metrics.** Failures surface only in container logs.
