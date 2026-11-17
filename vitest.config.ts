import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so tests don't load the PWA/build plugins.
export default defineConfig({
  test: {
    include: ['tests/{crazycat,dirtbike,qubo,racer,store}.test.ts'], // the rest use node:test (see npm test)
    environment: 'node',
  },
});
