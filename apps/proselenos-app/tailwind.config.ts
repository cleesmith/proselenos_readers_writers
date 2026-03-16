import type { Config } from 'tailwindcss';
import { themes } from './src/styles/themes';
import daisyui from 'daisyui';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // BooknoteItem.tsx highlight colors (dynamic template literals)
    'bg-red-500', 'bg-yellow-500', 'bg-green-500', 'bg-blue-500', 'bg-violet-500',
    'decoration-red-400', 'decoration-yellow-400', 'decoration-green-400', 'decoration-blue-400', 'decoration-violet-400',
    'bg-opacity-40',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Popups/Dropdowns
        popover: 'oklch(var(--b1) / <alpha-value>)',
        'popover-foreground': 'oklch(var(--bc) / <alpha-value>)',
        // Muted elements
        muted: 'oklch(var(--b2) / <alpha-value>)',
        'muted-foreground': 'oklch(var(--bc) / 0.7)',
        // Accent (selected)
        accent: 'oklch(var(--a) / <alpha-value>)',
        'accent-foreground': 'oklch(var(--ac) / <alpha-value>)',
        // Primary
        primary: 'oklch(var(--p) / <alpha-value>)',
        'primary-foreground': 'oklch(var(--pc) / <alpha-value>)',
        // Borders
        border: 'oklch(var(--b3) / <alpha-value>)',
        input: 'oklch(var(--b3) / <alpha-value>)',
        ring: 'oklch(var(--p) / <alpha-value>)',
        // Destructive
        destructive: 'oklch(var(--er) / <alpha-value>)',
        'destructive-foreground': 'oklch(var(--erc, var(--b1)) / <alpha-value>)',
        // Cards
        card: 'oklch(var(--b1) / <alpha-value>)',
        'card-foreground': 'oklch(var(--bc) / <alpha-value>)',
      },
    },
  },
  plugins: [daisyui, typography],
  daisyui: {
    themes: themes.reduce(
      (acc, { name, colors }) => {
        acc.push({
          [`${name}-light`]: colors.light,
        });
        acc.push({
          [`${name}-dark`]: colors.dark,
        });
        return acc;
      },
      [] as (Record<string, unknown> | string)[],
    ),
  },
};
export default config;
