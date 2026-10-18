import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';

const distributeMac: boolean = process.env['NORI_MAC_DISTRIBUTION'] === '1';

function requireMacSetting(name: string): string {
  const value: string | undefined = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} before building a signed macOS distribution.`);
  return value;
}

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Nori',
    asar: true,
    icon: './icons/icon',
    executableName: 'Nori',
    ignore: [/^\/(?!(?:dist|icons|node_modules)(?:\/|$)|package\.json$|LICENSE$)/],
    ...(distributeMac
      ? {
          appBundleId: requireMacSetting('NORI_MAC_BUNDLE_ID'),
          osxSign: {
            identity: requireMacSetting('NORI_MAC_SIGN_IDENTITY'),
            optionsForFile: () => ({ hardenedRuntime: true, entitlements: 'electron/entitlements.mac.plist' }),
          },
          osxNotarize: { keychainProfile: requireMacSetting('NORI_MAC_NOTARY_PROFILE') },
        }
      : {}),
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({ name: 'Nori', setupExe: 'NoriSetup.exe', setupIcon: './icons/icon.ico' }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({ options: { icon: './icons/icon.png' } }),
    new MakerDeb({ options: { icon: './icons/icon.png' } }),
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
};

export default config;
