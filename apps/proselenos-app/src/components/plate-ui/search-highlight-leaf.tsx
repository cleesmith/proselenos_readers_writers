'use client';

import type { PlateLeafProps } from 'platejs/react';
import { PlateLeaf } from 'platejs/react';

export function SearchHighlightLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf
      {...props}
      as="span"
      style={{
        backgroundColor: '#fff59d',
        borderRadius: '2px',
        padding: '1px 0',
      }}
    >
      {props.children}
    </PlateLeaf>
  );
}
