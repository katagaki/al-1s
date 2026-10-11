import { defineConfig } from 'cf/config';
import * as entrypoint from './src/index.js' with { type: 'cf-worker' };

export default defineConfig({
  worker: {
    name: 'al-1s',
    compatibilityDate: '2026-10-11',
    entrypoint,
    assets: {
      runWorkerFirst: true,
      htmlHandling: 'none',
      notFoundHandling: 'none',
    },
  },
});
