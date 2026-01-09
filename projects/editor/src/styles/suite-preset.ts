import { Preset } from '@primeuix/themes/types';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/Aura';

export const SuitePreset: Preset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{surface.50}',
      100: '{surface.100}',
      200: '{surface.200}',
      300: '{surface.300}',
      400: '{surface.400}',
      500: '{surface.500}',
      600: '{surface.600}',
      700: '{surface.700}',
      800: '{surface.800}',
      900: '{surface.900}',
      950: '{surface.950}',
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
          50: '{stone.50}',
          100: '{stone.100}',
          200: '{stone.200}',
          300: '{stone.300}',
          400: '{stone.400}',
          500: '{stone.500}',
          600: '{stone.600}',
          700: '{stone.700}',
          800: '{stone.800}',
          900: '{stone.900}',
          950: '{stone.950}',
        },
      },
      dark: {
        primary: {
          color: '{surface.0}',
          inverseColor: '{surface.950}',
          hoverColor: '{surface.100}',
          activeColor: '{surface.200}',
        },
        highlight: {
          background: '{surface.950}',
          focusBackground: '{surface.700}',
          color: '{surface.0}',
          focusColor: '{surface.0}',
        },
        ground: {
          background: '{surface.950}',
        },
        surface: {
          0: '#f6f2ec',
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
