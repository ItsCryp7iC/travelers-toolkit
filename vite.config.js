import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs';
import path from 'node:path';

const spaFallbackPlugin = () => ({
  name: 'spa-fallback-plugin',
  closeBundle() {
    const distPath = path.resolve(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');
    const notFoundPath = path.join(distPath, '404.html');
    if (fs.existsSync(indexPath)) {
      fs.copyFileSync(indexPath, notFoundPath);
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), spaFallbackPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})
