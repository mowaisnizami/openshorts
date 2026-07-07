import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['openshorts.app', 'www.openshorts.app'],
    proxy: {
      '/api': {
        target: 'http://192.168.18.105:8000',
        changeOrigin: true
      },
      '/videos': {
        target: 'http://192.168.18.105:8000',
        changeOrigin: true
      },
      '/thumbnails': {
        target: 'http://192.168.18.105:8000',
        changeOrigin: true
      },
      '/gallery': {
        target: 'http://192.168.18.105:8000',
        changeOrigin: true
      },
      '/video': {
        target: 'http://192.168.18.105:8000',
        changeOrigin: true
      },
      '/render': {
        target: 'http://renderer:3100',
        changeOrigin: true
      }
    }
  }
});
