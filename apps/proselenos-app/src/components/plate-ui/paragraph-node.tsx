'use client';

import type { PlateElementProps } from 'platejs/react';
import { PlateElement, useEditorRef } from 'platejs/react';

import { cn } from '@/lib/utils';

export function ParagraphElement(props: PlateElementProps) {
  const element = props.element as any;
  const vnType = element.vnType as string | undefined;
  // Visual Narrative: internal thought — italic, indented, muted
  if (vnType === 'internal') {
    return (
      <PlateElement {...props} className={cn('m-0 py-1 pl-8 pr-0 italic opacity-70')}>
        {props.children}
      </PlateElement>
    );
  }

  // Visual Narrative: emphasis line — centered, slightly larger
  if (vnType === 'emphasis') {
    return (
      <EmphasisElement {...props} />
    );
  }

  // Visual Narrative: scene audio — non-editable audio player UI
  if (vnType === 'scene_audio') {
    const audioLabel = element.audioLabel || 'audio';
    const audioId = element.audioId || '';
    return (
      <PlateElement {...props}>
        <div
          contentEditable={false}
          className="my-2 mx-auto max-w-sm text-center p-3 rounded-md border border-dashed opacity-70"
        >
          <div className="text-xs uppercase tracking-widest mb-1">
            {'\u{1F50A}'} {audioLabel}
          </div>
          <div className="text-xs truncate opacity-60">
            {audioId || 'no audio file selected'}
          </div>
        </div>
        <span className="hidden">{props.children}</span>
      </PlateElement>
    );
  }

  // Default paragraph — unchanged
  return (
    <PlateElement {...props} className={cn('m-0 px-0 py-1')}>
      {props.children}
    </PlateElement>
  );
}

function EmphasisElement(props: PlateElementProps) {
  const editor = useEditorRef();
  const isEmpty = editor.api.isEmpty(props.element);

  return (
    <PlateElement {...props} className={cn('m-0 px-0 py-1 text-center text-lg tracking-wide')}>
      {isEmpty && (
        <span
          contentEditable={false}
          suppressContentEditableWarning
          className="block text-[11px] uppercase tracking-widest opacity-50 mb-0.5 select-none pointer-events-none"
        >
          emphasis — a dramatic beat, a time jump, a sound effect
        </span>
      )}
      {props.children}
    </PlateElement>
  );
}
