import { execFileSync } from 'node:child_process';
import { buildSync } from 'esbuild';

execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'electron/tsconfig.json'], {
  stdio: 'inherit',
});

// Sandboxed preloads cannot load local modules. Bundle the shared IPC names into this file.
buildSync({
  entryPoints: ['electron/src/preload.ts'],
  outfile: 'dist/electron/preload.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});
