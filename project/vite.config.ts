import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // Absolute asset paths: with BrowserRouter a relative base breaks a refresh on a nested route.
  base: '/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // server config hanya untuk dev, tidak digunakan saat build
  server: {
    // Harus ada di ALLOWED_ORIGINS backend (default dev di lib/config.js); strictPort supaya tidak pindah diam-diam ke port lain.
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
});
