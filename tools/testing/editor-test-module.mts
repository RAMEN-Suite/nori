import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, type OnResolveArgs, type OnResolveResult, type PluginBuild } from 'esbuild';

/** Bundle trusted editor sources for Node service checks while sharing Angular's runtime identity. */
export async function editorTestModule<T>(entries: readonly string[]): Promise<T> {
  mkdirSync('.angular', { recursive: true });
  const directory: string = mkdtempSync('.angular/editor-check-');
  const cleanup: () => void = (): void => rmSync(directory, { recursive: true, force: true });
  process.once('exit', cleanup);
  const target: string = join(directory, 'editor.mjs');
  try {
    await build({
      stdin: {
        contents: entries.map((path: string): string => `export * from '${path}';`).join('\n'),
        resolveDir: process.cwd(),
        loader: 'ts',
      },
      bundle: true,
      packages: 'external',
      platform: 'node',
      format: 'esm',
      outfile: target,
      plugins: [
        {
          name: 'bundle-core-schema',
          setup(builder: PluginBuild): void {
            builder.onResolve(
              { filter: /^@ramen-suite\/core\/schemas\// },
              (args: OnResolveArgs): OnResolveResult => ({
                path: fileURLToPath(import.meta.resolve(args.path)),
              }),
            );
          },
        },
      ],
    });
    return (await import(pathToFileURL(target).href)) as T;
  } catch (error: unknown) {
    cleanup();
    throw error;
  }
}
