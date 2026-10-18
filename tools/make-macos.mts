import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot: string = fileURLToPath(new URL('..', import.meta.url));
const signed: boolean = process.argv.includes('--signed');
const environment: NodeJS.ProcessEnv = { ...process.env, NORI_MAC_DISTRIBUTION: signed ? '1' : '0' };

function run(command: string, args: readonly string[]): void {
  execFileSync(command, args, { cwd: projectRoot, env: environment, stdio: 'inherit' });
}

function checkSigning(): void {
  for (const name of ['NORI_MAC_BUNDLE_ID', 'NORI_MAC_SIGN_IDENTITY', 'NORI_MAC_NOTARY_PROFILE']) {
    if (!environment[name]?.trim()) throw new Error(`Set ${name} before running make:mac:signed. See README.md.`);
  }
  const identity: string = environment['NORI_MAC_SIGN_IDENTITY']?.trim() ?? '';
  if (!identity.startsWith('Developer ID Application:')) {
    throw new Error('NORI_MAC_SIGN_IDENTITY must be the full Developer ID Application certificate name.');
  }
  const identities: string = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
  if (!identities.includes(`"${identity}"`)) {
    throw new Error('The Developer ID Application certificate and private key must be installed in your keychain.');
  }
  execFileSync('xcrun', ['--find', 'notarytool'], { stdio: 'ignore' });
}

function makeMac(): void {
  if (process.platform !== 'darwin') throw new Error('Build the macOS application on a Mac.');
  if (process.argv.slice(2).some((argument: string): boolean => argument !== '--signed')) {
    throw new Error('Usage: npm run make:mac or npm run make:mac:signed. Both build Apple Silicon (arm64).');
  }
  if (signed) checkSigning();

  run('npm', ['run', 'build']);
  run(process.execPath, [
    path.join(projectRoot, 'node_modules/@electron-forge/cli/dist/electron-forge.js'),
    'make',
    '--platform=darwin',
    '--arch=arm64',
  ]);
  if (signed) {
    const appPath: string = path.join(projectRoot, 'out/Nori-darwin-arm64/Nori.app');
    run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
    run('xcrun', ['stapler', 'validate', appPath]);
    run('spctl', ['--assess', '--type', 'execute', '--verbose=2', appPath]);
  }
  console.info(
    signed
      ? 'Signed and notarized Apple Silicon ZIP ready in out/make/zip/darwin/arm64.'
      : 'Unsigned Apple Silicon ZIP ready in out/make/zip/darwin/arm64. Use make:mac:signed for distribution.',
  );
}

try {
  makeMac();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
