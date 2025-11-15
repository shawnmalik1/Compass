import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/upload': 'http://localhost:3000',
      '/embed': 'http://localhost:3000',
      '/nearest': 'http://localhost:3000',
      '/analyze': 'http://localhost:3000',
      '/articles': 'http://localhost:3000',
    },
  },
});
