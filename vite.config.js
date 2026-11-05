import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative paths so dist/ works from any folder (e.g. Laragon /hocus/dist/)
  server: { port: Number(process.env.PORT) || 5173 },
  preview: { port: Number(process.env.PORT) || 4173 },
  worker: { format: 'es' },
});
