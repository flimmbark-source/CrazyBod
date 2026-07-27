import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `host: true` binds 0.0.0.0 so the GitHub Codespaces port forwarder can reach
// the server; a pinned `strictPort` keeps the forwarded *.app.github.dev URL
// stable instead of drifting 5173 -> 5174 -> 5175 across restarts (which leaves
// old forwarded URLs 404ing). `allowedHosts` lets the Codespaces proxy through.
const server = {
  host: true,
  port: 5173,
  strictPort: true,
  allowedHosts: ['.app.github.dev'],
}

export default defineConfig({
  base: './',
  plugins: [react()],
  server,
  preview: { ...server, port: 4173 },
})
