import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot: string = fileURLToPath(new URL('..', import.meta.url));

function makeWindows(): void {
  if (process.platform !== 'win32') throw new Error('Run make:win on Windows to create the Windows x64 installer.');
  if (process.argv.length > 2) throw new Error('Usage: npm run make:win. This builds Windows x64.');
  const npmCli: string | undefined = process.env['npm_execpath'];
  if (!npmCli) throw new Error('Run this build through npm run make:win.');

  const options: ExecFileSyncOptions = {
    cwd: projectRoot,
    env: { ...process.env, NORI_MAC_DISTRIBUTION: '0' },
    stdio: 'inherit',
  };
  execFileSync(process.execPath, [npmCli, 'run', 'build'], options);
  execFileSync(
    process.execPath,
    [path.join(projectRoot, 'node_modules/@electron-forge/cli/dist/electron-forge.js'), 'make', '--platform=win32', '--arch=x64'],
    options,
  );
  console.info('Unsigned Windows x64 installer ready in out/make/squirrel.windows/x64.');
}

try {
  makeWindows();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
