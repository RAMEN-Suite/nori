import { version } from '../../../package.json';

export const environment: Readonly<{
  appVersion: string;
  manifestVersion: string;
  schemaVersion: string;
  repositoryURL: string;
  schemaURL: string;
  coreURL: string;
}> = {
  appVersion: version,
  manifestVersion: '1.0.0',
  schemaVersion: '1.0.0',

  repositoryURL: 'https://github.com/RAMEN-Suite',
  schemaURL: 'https://ramen-schema.org',
  coreURL: 'https://github.com/RAMEN-Suite/ramen-core',
};
