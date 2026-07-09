import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // `__dirname` doesn't exist in an ESM config ("type": "module").
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
