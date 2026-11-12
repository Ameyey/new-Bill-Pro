import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 1. THIS PART IS USED BY VERCEL:
  plugins: [react()], 

  // 2. THIS PART IS COMPLETELY IGNORED BY VERCEL:
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://new-bill-pro-backend.vercel.app', // <--- Only for local development
        changeOrigin: true
      }
    }
  }
});

