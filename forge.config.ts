import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './icons/icon',
    executableName: 'nori',
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({ options: { icon: './icons/icon.png' } }),
    new MakerDeb({ options: { icon: './icons/icon.png' } }),
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: '',
          name: 'Nori',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
};

export default config;
