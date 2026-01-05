import { Preset } from '@primeuix/themes/types';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/Aura';

export const SuitePreset: Preset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{gray.50}',
      100: '{gray.100}',
      200: '{gray.200}',
      300: '{gray.300}',
      400: '{gray.400}',
      500: '{gray.500}',
      600: '{gray.600}',
      700: '{gray.700}',
      800: '{gray.800}',
      900: '{gray.900}',
      950: '{gray.950}',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{surface.950}',
          inverseColor: '{surface.0}',
          hoverColor: '{surface.900}',
          activeColor: '{surface.800}',
        },
        highlight: {
          background: '{surface.950}',
          focusBackground: '{surface.700}',
          color: '{surface.0}',
          focusColor: '{surface.0}',
        },
        ground: {
          background: '{surface.50}',
        },
        surface: {
          0: '#ffffff',
          50: '{slate.50}',
          100: '{slate.100}',
          200: '{slate.200}',
          300: '{slate.300}',
          400: '{slate.400}',
          500: '{slate.500}',
          600: '{slate.600}',
          700: '{slate.700}',
          800: '{slate.800}',
          900: '{slate.900}',
          950: '{slate.950}',
        },
      },
      dark: {
        primary: {
          color: '{surface.50}',
          inverseColor: '{surface.950}',
          hoverColor: '{surface.100}',
          activeColor: '{surface.200}',
        },
        highlight: {
          background: 'rgba(250, 250, 250, .16)',
          focusBackground: 'rgba(250, 250, 250, .24)',
          color: 'rgba(255,255,255,.87)',
          focusColor: 'rgba(255,255,255,.87)',
        },
        ground: {
          background: '{surface.950}',
        },
        surface: {
          0: '#ffffff',
          50: '{gray.50}',
          100: '{gray.100}',
          200: '{gray.200}',
          300: '{gray.300}',
          400: '{gray.400}',
          500: '{gray.500}',
          600: '{gray.600}',
          700: '{gray.700}',
          800: '{gray.800}',
          900: '{gray.900}',
          950: '{gray.950}',
        },
      },
    },
  },
  components: {
    fieldset: {
      legend: {
        background: 'transparent',
        fontWeight: '300',
      },
    },
  },
});
