import path from 'path';
import { defineConfig } from '@lark-apaas/coding-preset-vite-react';

const devPlatform = JSON.stringify({
  csrfToken: 'dev',
  userId: '',
  appId: '',
  appName: '速卖通定价系统',
  appAvatar: '',
  appDescription: '',
  loginUrl: '',
  userType: '',
  tenantId: '',
  environment: 'development',
  showBadge: false,
  appPublished: null,
  basename: '/',
});

export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:18080',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    {
      name: 'dev-template-replace',
      transformIndexHtml: {
        handler: (html) => {
          return html
            .replace(/\{\{\{?__platform__\}??\}/g, devPlatform)
            .replaceAll('{{appId}}', '')
            .replaceAll('{{userId}}', '')
            .replaceAll('{{tenantId}}', '')
            .replaceAll('{{userName}}', '')
            .replaceAll('{{csrfToken}}', 'dev')
            .replaceAll('{{environment}}', 'production')
            .replaceAll('{{basename}}', '/')
            .replaceAll('{{appName}}', '速卖通定价系统')
            .replaceAll('{{appAvatar}}', '')
            .replaceAll('{{appDescription}}', '')
            .replaceAll('{{loginUrl}}', '')
            .replaceAll('{{userType}}', '');
        },
      },
    },
    {
      name: 'mock-badge-off',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.includes('/get_published') || req.url?.includes('/user-points') || req.url?.startsWith('/spark/')) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ app_info: { show_badge: false }, data: null }));
            return;
          }
          next();
        });
      },
    },
  ],
});
