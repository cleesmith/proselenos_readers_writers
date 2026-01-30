'use client';

import type { PlateLeafProps } from 'platejs/react';
import { PlateLeaf } from 'platejs/react';
import { useThemeStore } from '@/store/themeStore';

export function SearchHighlightLeaf(props: PlateLeafProps) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  return (
    <PlateLeaf
      {...props}
      as="span"
      style={{
        backgroundColor: isDarkMode ? '#b8860b' : '#fff59d',
        borderRadius: '2px',
        padding: '1px 0',
      }}
    >
      {props.children}
    </PlateLeaf>
  );
}
