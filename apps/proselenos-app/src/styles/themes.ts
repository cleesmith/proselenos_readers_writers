import tinycolor from 'tinycolor2';
import { stubTranslation as _ } from '../utils/misc';
import { getContrastHex, getContrastOklch, hexToOklch } from '../utils/color';

export type BaseColor = {
  bg: string;
  fg: string;
  primary: string;
};

export type ThemeMode = 'auto' | 'light' | 'dark';

export type Palette = {
  'base-100': string;
  'base-200': string;
  'base-300': string;
  'base-content': string;
  neutral: string;
  'neutral-content': string;
  primary: string;
  secondary: string;
  accent: string;
};

export type Theme = {
  name: string;
  label: string;
  colors: {
    light: Palette;
    dark: Palette;
  };
  isCustomizale?: boolean;
};

export type CustomTheme = {
  name: string;
  label: string;
  colors: {
    light: BaseColor;
    dark: BaseColor;
  };
};

export const generateLightPalette = ({ bg, fg, primary }: BaseColor) => {
  return {
    'base-100': bg, // Main background
    'base-200': tinycolor(bg).darken(5).toHexString(), // Slightly darker
    'base-300': tinycolor(bg).darken(12).toHexString(), // More darker
    'base-content': fg, // Main text color
    neutral: tinycolor(bg).darken(15).desaturate(20).toHexString(), // Muted neutral
    'neutral-content': tinycolor(fg).lighten(20).desaturate(20).toHexString(), // Slightly lighter text
    primary: primary,
    secondary: tinycolor(primary).lighten(20).toHexString(), // Lighter secondary
    accent: tinycolor(primary).analogous()[1]!.toHexString(), // Analogous accent
  } as Palette;
};

export const generateDarkPalette = ({ bg, fg, primary }: BaseColor) => {
  return {
    'base-100': bg, // Main background
    'base-200': tinycolor(bg).lighten(5).toHexString(), // Slightly lighter
    'base-300': tinycolor(bg).lighten(12).toHexString(), // More lighter
    'base-content': fg, // Main text color
    neutral: tinycolor(bg).lighten(15).desaturate(20).toHexString(), // Muted neutral
    'neutral-content': tinycolor(fg).darken(20).desaturate(20).toHexString(), // Darkened text
    primary: primary,
    secondary: tinycolor(primary).darken(20).toHexString(), // Darker secondary
    accent: tinycolor(primary).triad()[1]!.toHexString(), // Triad accent
  } as Palette;
};

export const themes = [
  {
    name: 'default',
    label: _('Default'),
    colors: {
      light: generateLightPalette({ fg: '#171717', bg: '#ffffff', primary: '#0066cc' }),
      dark: generateDarkPalette({ fg: '#e0e0e0', bg: '#222222', primary: '#77bbee' }),
    },
  },
] as Theme[];

const generateCustomThemeVariables = (palette: Palette, fallbackIncluded = false): string => {
  const colors = `
    --b1: ${hexToOklch(palette['base-100'])};
    --b2: ${hexToOklch(palette['base-200'])};
    --b3: ${hexToOklch(palette['base-300'])};
    --bc: ${hexToOklch(palette['base-content'])};
    
    --p: ${hexToOklch(palette.primary)};
    --pc: ${getContrastOklch(palette.primary)};
    
    --s: ${hexToOklch(palette.secondary)};
    --sc: ${getContrastOklch(palette.secondary)};
    
    --a: ${hexToOklch(palette.accent)};
    --ac: ${getContrastOklch(palette.accent)};
    
    --n: ${hexToOklch(palette.neutral)};
    --nc: ${hexToOklch(palette['neutral-content'])};
    
    --in: 69.37% 0.047 231deg;
    --inc: 100% 0 0deg;
    --su: 78.15% 0.12 160deg;
    --suc: 100% 0 0deg;
    --wa: 90.69% 0.123 84deg;
    --wac: 0% 0 0deg;
    --er: 70.9% 0.184 22deg;
    --erc: 100% 0 0deg;
  `;

  const fallbackColors = `
    --fallback-b1: ${palette['base-100']};
    --fallback-b2: ${palette['base-200']};
    --fallback-b3: ${palette['base-300']};
    --fallback-bc: ${palette['base-content']};

    --fallback-p: ${palette.primary};
    --fallback-pc: ${getContrastHex(palette.primary)};

    --fallback-s: ${palette.secondary};
    --fallback-sc: ${getContrastHex(palette.secondary)};

    --fallback-a: ${palette.accent};
    --fallback-ac: ${getContrastHex(palette.accent)};

    --fallback-n: ${palette.neutral};
    --fallback-nc: ${palette['neutral-content']};

    --fallback-in: #ff0000;
    --fallback-inc: #ffffff;
    --fallback-su: #00ff00;
    --fallback-suc: #000000;
    --fallback-wa: #ffff00;
    --fallback-wac: #000000;
    --fallback-er: #ff8000;
    --fallback-erc: #000000;
  `;

  return colors + (fallbackIncluded ? fallbackColors : '');
};

export const applyCustomTheme = (
  customTheme?: CustomTheme,
  themeName?: string,
  fallbackIncluded = false,
) => {
  if (!customTheme && !themeName) return;

  const lightThemeName = customTheme ? `${customTheme.name}-light` : `${themeName}-light`;
  const darkThemeName = customTheme ? `${customTheme.name}-dark` : `${themeName}-dark`;

  const lightPalette = customTheme
    ? generateLightPalette(customTheme.colors.light)
    : (themes.find((t) => t.name === themeName) || themes[0]!).colors.light;

  const darkPalette = customTheme
    ? generateDarkPalette(customTheme.colors.dark)
    : (themes.find((t) => t.name === themeName) || themes[0]!).colors.dark;

  const css = `
    [data-theme="${lightThemeName}"] {
      ${generateCustomThemeVariables(lightPalette, fallbackIncluded)}
    }
    
    [data-theme="${darkThemeName}"] {
      ${generateCustomThemeVariables(darkPalette, fallbackIncluded)}
    }
    
    :root {
      --${lightThemeName}: 1;
      --${darkThemeName}: 1;
    }
  `;

  const styleElement = document.createElement('style');
  styleElement.id = `theme-${customTheme ? customTheme.name : themeName}-styles`;
  styleElement.textContent = css;

  const existingStyle = document.getElementById(styleElement.id);
  if (existingStyle) {
    existingStyle.remove();
  }

  document.head.appendChild(styleElement);

  return {
    light: lightThemeName,
    dark: darkThemeName,
  };
};
