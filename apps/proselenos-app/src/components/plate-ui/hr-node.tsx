'use client';

import type { PlateElementProps } from 'platejs/react';
import {
  PlateElement,
  useFocused,
  useReadOnly,
  useSelected,
} from 'platejs/react';

import { cn } from '@/lib/utils';

export function HrElement(props: PlateElementProps) {
  const readOnly = useReadOnly();
  const selected = useSelected();
  const focused = useFocused();
  const vnType = (props.element as any).vnType as string | undefined;

  // Visual Narrative: scene break — centered bullet separator
  if (vnType === 'scene_break') {
    return (
      <PlateElement {...props}>
        <div className="py-4 text-center select-none" contentEditable={false}>
          <span
            className={cn(
              'tracking-[0.5em] text-sm opacity-40',
              selected && focused && 'ring-2 ring-ring ring-offset-2 rounded px-2',
              !readOnly && 'cursor-pointer'
            )}
          >
            {'\u2022 \u2022 \u2022'}
          </span>
        </div>
        {props.children}
      </PlateElement>
    );
  }

  // Default HR — unchanged
  return (
    <PlateElement {...props}>
      <div className="py-6" contentEditable={false}>
        <hr
          className={cn(
            'h-0.5 rounded-sm border-none bg-muted bg-clip-content',
            selected && focused && 'ring-2 ring-ring ring-offset-2',
            !readOnly && 'cursor-pointer'
          )}
        />
      </div>
      {props.children}
    </PlateElement>
  );
}
