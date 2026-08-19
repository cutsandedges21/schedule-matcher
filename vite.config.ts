/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // Client errors (src/lib/errorLog.ts) are useless without this: a
    // minified stack is "a1b2c3.js:1:4821", not a component name and line.
    // Safe here specifically — this is a client-side PWA with no secrets in
    // the bundle (VITE_SUPABASE_URL/ANON_KEY are meant to be public; the
    // Gemini keys live only in the Edge Function's server-side env) — so
    // publishing source via sourcemaps costs nothing an attacker didn't
    // already have from reading the shipped JS. An app with client-side
    // secrets would need a different answer (upload-and-strip via a CI step).
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
});
