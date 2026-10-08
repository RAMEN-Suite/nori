export enum APP_THEME {
  SYSTEM = 'system',
  LIGHT = 'light',
  DARK = 'dark',
}

export interface AppTheme {
  readonly id: APP_THEME;
  readonly name: string;
  readonly description: string;
  readonly sushiTheme: string;
  readonly colourScheme: 'system' | 'light' | 'dark';
}

export const DEFAULT_THEME: AppTheme = {
  id: APP_THEME.SYSTEM,
  name: 'System',
  description: 'Follow your device’s appearance.',
  sushiTheme: 'sushi',
  colourScheme: 'system',
};

/** Register additional themes here after their Sushi styles are available. */
export const APP_THEMES: readonly AppTheme[] = [
  DEFAULT_THEME,
  {
    id: APP_THEME.LIGHT,
    name: 'Light',
    description: 'Bright surfaces, quiet details.',
    sushiTheme: 'sushi',
    colourScheme: 'light',
  },
  {
    id: APP_THEME.DARK,
    name: 'Dark',
    description: 'Muted surfaces for a softer workspace.',
    sushiTheme: 'sushi-dark',
    colourScheme: 'dark',
  },
];
