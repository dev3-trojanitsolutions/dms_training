import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'
import type { ProxyOptions } from 'vite'

// Same setup as apps/dms/frontend: the proxy pins the backend site to
// local.com, so the dev server works when opened as localhost too.
const proxy: Record<string, ProxyOptions> = {
  '^/(desk|app|login|api|assets|files|private)': {
    target: 'http://local.com:8000',
    changeOrigin: true,
    ws: true,
    configure(proxyServer) {
      proxyServer.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('X-Frappe-Site-Name', 'local.com')
      })
    },
  },
}

export default defineConfig({
  plugins: [frappeui({ frontendRoute: '/training', frappeProxy: false }), vue()],
  server: {
    port: 8081,
    allowedHosts: ['local.com', 'localhost'],
    proxy,
    // src/sim/registry.ts imports ../dms_training/screens.json, which the
    // server reads too.
    fs: { allow: ['..'] },
  },
})
