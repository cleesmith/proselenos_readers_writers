'use client';

import type { PlateElementProps } from 'platejs/react';
import {
  PlateElement,
  useFocused,
  useReadOnly,
  useSelected,
} from 'platejs/react';

import { cn } from '@/lib/utils';

export function LineBreakElement(props: PlateElementProps) {
  const readOnly = useReadOnly();
  const selected = useSelected();
  const focused = useFocused();

  return (
    <PlateElement {...props}>
      <div
        className={cn(
          'py-1 select-none',
          selected && focused && 'ring-2 ring-ring ring-offset-2 rounded',
          !readOnly && 'cursor-pointer'
        )}
        contentEditable={false}
      >
        {/* Empty line — visually identical to a blank paragraph */}
        <div className="h-[1.5em]" />
      </div>
      {props.children}
    </PlateElement>
  );
}
