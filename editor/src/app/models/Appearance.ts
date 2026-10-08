export enum APP_THEME {
  SYSTEM = 'system',
  LIGHT = 'light',
  DARK = 'dark',
}

export interface AppTheme {
  readonly id: APP_THEME;
  readonly sushiTheme: string;
  readonly colourScheme: 'system' | 'light' | 'dark';
}

export const DEFAULT_THEME: AppTheme = {
  id: APP_THEME.SYSTEM,
  sushiTheme: 'sushi',
  colourScheme: 'system',
};

/** Register additional themes here after their Sushi styles are available. */
export const APP_THEMES: readonly AppTheme[] = [
  DEFAULT_THEME,
  {
    id: APP_THEME.LIGHT,
    sushiTheme: 'sushi',
    colourScheme: 'light',
  },
  {
    id: APP_THEME.DARK,
    sushiTheme: 'sushi-dark',
    colourScheme: 'dark',
  },
];
