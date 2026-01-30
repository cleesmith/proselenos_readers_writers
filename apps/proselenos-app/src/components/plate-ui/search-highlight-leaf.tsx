'use client';

import type { PlateLeafProps } from 'platejs/react';
import { PlateLeaf } from 'platejs/react';

export function SearchHighlightLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf
      {...props}
      as="span"
      className="search-highlight"
    >
      {props.children}
    </PlateLeaf>
  );
}
