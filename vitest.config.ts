import { defineConfig } from 'vitest/config';

// I test girano nel fuso orario italiano per verificare anche l'ora legale.
process.env.TZ = 'Europe/Rome';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: { TZ: 'Europe/Rome' },
  },
});
