import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import pkg from './package.json' with { type: 'json' };

const [major, minor] = pkg.version.split('.');
const patch = process.env.PATCH_NUMBER;
const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
const appVersion = patch
  ? `${major}.${minor}.${patch}`
  : `${major}.${minor}.0-dev.${commitHash}`;

export default defineConfig({
  plugins: [react()],
  base: '/ScryPrint/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
});
