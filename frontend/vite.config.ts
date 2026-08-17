import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const certsDir = fileURLToPath(new URL('../certs', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Bind to all interfaces (not just localhost) so other devices on the
    // LAN can open this dev server.
    host: true,
    // Allows access through the temporary cloudflared tunnel hostname
    // (and any LAN hostname) during local network/tunnel testing.
    allowedHosts: true,
    // Camera/mic access requires a secure context, which browsers don't
    // grant to a plain LAN IP over http — so this dev server runs over TLS
    // with a shared mkcert-issued certificate (also used by the backend and
    // LiveKit, see backend/src/config/env.ts and livekit.yaml).
    https: {
      cert: readFileSync(`${certsDir}/imeet.pem`),
      key: readFileSync(`${certsDir}/imeet-key.pem`),
    },
  },
  worker: {
    // livekit-client's e2ee-worker ships as an ES module
    format: 'es',
  },
})
