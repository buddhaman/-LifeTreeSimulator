import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/demos/lifetree/',
  plugins: [react()],
  server: {
    proxy: {
      // Proxy GreenPT API requests to bypass CORS
      '/api/greenpt': {
        target: 'https://api.greenpt.ai',
        changeOrigin: true,
        rewrite: (path) => {
          const newPath = path.replace(/^\/api\/greenpt/, '');
          console.log('[PROXY] Rewriting path:', path, '->', 'https://api.greenpt.ai' + newPath);
          return newPath;
        },
        secure: true,
        headers: {
          host: 'api.greenpt.ai',
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.error('[PROXY ERROR]', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Remove browser-specific headers that cause 403
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
            proxyReq.removeHeader('sec-fetch-dest');
            proxyReq.removeHeader('sec-fetch-mode');
            proxyReq.removeHeader('sec-fetch-site');
            proxyReq.removeHeader('priority');

            console.log('[PROXY REQUEST]', req.method, req.url);
            console.log('[PROXY REQUEST] Headers after cleanup:', proxyReq.getHeaders());
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('[PROXY RESPONSE]', proxyRes.statusCode, req.url);
            console.log('[PROXY RESPONSE] Headers:', proxyRes.headers);
          });
        }
      }
    }
  }
})
