#!/usr/bin/env node
// Driver for running + smoke-testing the imeet video conferencing app.
// Usage: node driver.mjs <start|smoke|stop>
//   start  — bring up docker services + backend + frontend, wait until ready
//   smoke  — signup -> dashboard -> create meeting -> recordings/recap page,
//            screenshots to ./shots/, prints console/page errors
//   stop   — kill backend/frontend dev servers + docker compose down
//
// Requires: docker, node >= 18. Playwright is installed on first `smoke`
// run into this skill's own node_modules (npm install --no-save), so it
// never touches the app's own package.json.

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "../../.."); // repo root
const SKILL_DIR = import.meta.dirname;
const STATE_FILE = path.join(SKILL_DIR, ".state.json");
const SHOT_DIR = path.join(SKILL_DIR, "shots");

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}
function writeState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

function waitForPort(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok || res.status < 500) return resolve(true);
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) return reject(new Error(`Timed out waiting for ${url}`));
      setTimeout(tick, 1000);
    };
    tick();
  });
}

function detectVitePort(logPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf-8") : "";
      const m = log.match(/Local:\s+https?:\/\/localhost:(\d+)/);
      if (m) return resolve(Number(m[1]));
      if (Date.now() > deadline) return reject(new Error("Timed out detecting Vite port"));
      setTimeout(tick, 500);
    };
    tick();
  });
}

async function cmdStart() {
  console.log("Starting docker compose services (postgres, redis, livekit, minio, egress)...");
  execSync("docker compose up -d", { cwd: ROOT, stdio: "inherit" });

  const isWin = process.platform === "win32";

  console.log("Starting backend (npm run dev)...");
  const backendLog = path.join(SKILL_DIR, "backend.log");
  const backendOut = fs.openSync(backendLog, "w");
  const backend = spawn("npm", ["run", "dev"], {
    cwd: path.join(ROOT, "backend"),
    detached: !isWin,
    shell: isWin,
    stdio: ["ignore", backendOut, backendOut],
  });
  backend.unref();

  console.log("Starting frontend (npm run dev)...");
  const frontendLog = path.join(SKILL_DIR, "frontend.log");
  const frontendOut = fs.openSync(frontendLog, "w");
  const frontend = spawn("npm", ["run", "dev"], {
    cwd: path.join(ROOT, "frontend"),
    detached: !isWin,
    shell: isWin,
    stdio: ["ignore", frontendOut, frontendOut],
  });
  frontend.unref();

  // Backend serves HTTPS with a self-signed dev cert (see backend/src/server.ts) —
  // node's fetch rejects that by default, so relax cert validation for this check.
  const prevTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    await waitForPort("https://localhost:4000/api/health", 30_000);
  } finally {
    if (prevTlsReject === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTlsReject;
  }
  console.log("Backend up on :4000");

  // Vite picks the next free port if 5173 is taken by an unrelated project
  // on this machine — don't assume 5173, read it from the dev server log.
  const frontendPort = await detectVitePort(frontendLog, 30_000);
  console.log(`Frontend up on :${frontendPort}`);

  writeState({ backendPid: backend.pid, frontendPid: frontend.pid, frontendPort });
  console.log(`\nReady. Frontend: https://localhost:${frontendPort}`);
}

function ensurePlaywright() {
  const pwDir = path.join(SKILL_DIR, "node_modules", "playwright");
  if (!fs.existsSync(pwDir)) {
    console.log("Installing Playwright into this skill's own node_modules (one-time)...");
    execSync("npm install --no-save playwright", { cwd: SKILL_DIR, stdio: "inherit" });
  }
  // Browser binaries are cached per-machine at ~/.cache/ms-playwright, shared
  // across projects — `--with-deps` needs sudo and isn't available/needed in
  // this container, so only fetch the browser itself (no-op if already cached).
  execSync("npx playwright install chromium", { cwd: SKILL_DIR, stdio: "inherit" });
}

async function cmdSmoke() {
  const state = readState();
  const frontendPort = state.frontendPort ?? 5173;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  ensurePlaywright();

  const { chromium } = await import(
    pathToFileURL(path.join(SKILL_DIR, "node_modules", "playwright", "index.mjs")).href
  );
  const errors = [];
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  // Backend/frontend serve HTTPS with a self-signed mkcert-style dev cert
  // (see backend/src/server.ts) — ignore the resulting cert warning here the
  // same way a developer would click through it in a real browser. Camera/mic
  // permissions must be pre-granted too — without them the join flow can
  // stall waiting on a getUserMedia prompt that never resolves, even with
  // --use-fake-ui-for-media-stream.
  const page = await (
    await browser.newContext({ ignoreHTTPSErrors: true, permissions: ["camera", "microphone"] })
  ).newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  async function shot(name) {
    const f = path.join(SHOT_DIR, `${name}.png`);
    await page.screenshot({ path: f });
    console.log("screenshot:", f);
  }

  const email = `smoketest+${Date.now()}@example.com`;
  const base = `https://localhost:${frontendPort}`;

  await page.goto(`${base}/signup`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Sign up", { timeout: 15_000 });
  await shot("01-signup");

  await page.fill('input[placeholder="Name"]', "Smoke Test");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Welcome,", { timeout: 15_000 });
  await shot("02-dashboard");

  await page.fill('input[placeholder="Meeting title (optional)"]', "Smoke Test Meeting");
  await page.click('button:has-text("Create")');
  await page.waitForURL(/\/meeting\//, { timeout: 15_000 });

  // Landing in a meeting room always stops at the PreJoinLobby (device/name
  // check) first — it only actually connects to LiveKit once that form is
  // submitted.
  await page.waitForSelector('button:has-text("Join now")', { timeout: 15_000 });
  await shot("03-prejoin");
  await page.click('button:has-text("Join now")');
  await page.waitForSelector("text=Joining meeting...", { state: "detached", timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await shot("04-meeting-room");

  const meetingCode = page.url().split("/meeting/")[1];
  await page.goto(`${base}/meeting/${meetingCode}/recordings`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Recordings for", { timeout: 15_000 });
  await shot("05-recordings-recap");

  console.log("Meeting code:", meetingCode);
  console.log(
    "console/page errors (ignore NotSupportedError/NotFoundError for mic/camera — expected, no devices in headless container):",
  );
  console.log(JSON.stringify(errors, null, 2));

  await browser.close();
}

function cmdStop() {
  const isWin = process.platform === "win32";
  const state = readState();
  if (isWin) {
    for (const pid of [state.backendPid, state.frontendPid]) {
      if (!pid) continue;
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      } catch {
        // already dead
      }
    }
    try {
      execSync(
        'wmic process where "CommandLine like \'%tsx watch src/server.ts%\'" call terminate',
        { stdio: "ignore" },
      );
    } catch {}
    try {
      execSync('wmic process where "CommandLine like \'%vite%\'" call terminate', {
        stdio: "ignore",
      });
    } catch {}
  } else {
    for (const pid of [state.backendPid, state.frontendPid]) {
      if (!pid) continue;
      try {
        process.kill(-pid, "SIGTERM"); // negative pid = kill the process group (npm + its child)
      } catch {
        // already dead
      }
    }
    try {
      execSync("pkill -f 'tsx watch src/server.ts'", { stdio: "ignore" });
    } catch {}
    try {
      execSync("pkill -f vite", { stdio: "ignore" });
    } catch {}
  }
  execSync("docker compose down", { cwd: ROOT, stdio: "inherit" });
  writeState({});
  console.log("Stopped.");
}

const command = process.argv[2];
if (command === "start") await cmdStart();
else if (command === "smoke") await cmdSmoke();
else if (command === "stop") cmdStop();
else {
  console.log("Usage: node driver.mjs <start|smoke|stop>");
  process.exit(1);
}
