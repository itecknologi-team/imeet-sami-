import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const certsDir = fileURLToPath(new URL('../certs', import.meta.url))
const certPath = `${certsDir}/imeet.pem`
const keyPath = `${certsDir}/imeet-key.pem`

// Camera/mic access requires a secure context, which browsers don't grant to a
// plain LAN IP over http — so the dev server runs over TLS with a shared
// mkcert-issued certificate (also used by the backend and LiveKit, see
// backend/src/config/env.ts and livekit.yaml).
//
// This has to be conditional: the certs are gitignored and don't exist in CI or
// in the production image, and reading them unconditionally made `vite build`
// fail there before it ever started compiling. Production serves the built
// assets through Caddy, which terminates real TLS.
const devCertsPresent = existsSync(certPath) && existsSync(keyPath)

// y-monaco does `import 'monaco-editor/esm/vs/editor/editor.api.js'`, a deep
// path that monaco-editor 0.56 broke: its new package `exports` map rewrites
// "./*.js" to "./esm/vs/*.js", so that specifier resolves to the doubled
// (nonexistent) ".../esm/vs/esm/vs/editor/editor.api.js" and the production
// build fails outright. The dev server tolerated it, so this only ever
// surfaced when building for real. Point the specifier at the actual file.
const monacoEditorApi = fileURLToPath(
  new URL('./node_modules/monaco-editor/esm/vs/editor/editor.api.js', import.meta.url),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [{ find: /^monaco-editor\/esm\/vs\/editor\/editor\.api\.js$/, replacement: monacoEditorApi }],
  },
  server: {
    port: 5173,
    // Bind to all interfaces (not just localhost) so other devices on the
    // LAN can open this dev server.
    host: true,
    // Allows access through the temporary cloudflared tunnel hostname
    // (and any LAN hostname) during local network/tunnel testing.
    allowedHosts: true,
    ...(devCertsPresent
      ? {
          https: {
            cert: readFileSync(certPath),
            key: readFileSync(keyPath),
          },
        }
      : {}),
  },
  build: {
    // Assets are fingerprinted and served with long-lived caching by Caddy;
    // sourcemaps are excluded so production bundles don't ship readable source.
    sourcemap: false,
  },
  worker: {
    // livekit-client's e2ee-worker ships as an ES module
    format: 'es',
  },
})
