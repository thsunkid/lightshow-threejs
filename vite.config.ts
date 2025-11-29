import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@audio': resolve(__dirname, 'src/audio'),
      '@stage': resolve(__dirname, 'src/stage'),
      '@style': resolve(__dirname, 'src/style'),
      '@mapping': resolve(__dirname, 'src/mapping'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ['essentia.js'],
  },
});
