'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { PlateElement, type PlateElementProps, useEditorRef } from 'platejs/react';

import { cn } from '@/lib/utils';

export function BlockquoteElement(props: PlateElementProps) {
  const element = props.element as any;
  const vnType = element.vnType as string | undefined;

  // Visual Narrative: dialogue with speaker label
  if (vnType === 'dialogue') {
    return <DialogueElement {...props} />;
  }

  // Default blockquote — unchanged
  return (
    <PlateElement
      as="blockquote"
      className="my-1 border-l-2 pl-6 italic"
      {...props}
    />
  );
}

function DialogueElement(props: PlateElementProps) {
  const element = props.element as any;
  const editor = useEditorRef();
  const speaker = (element.speaker || '') as string;
  const [localSpeaker, setLocalSpeaker] = useState(speaker);

  // Sync from Plate node when it changes externally (undo, section switch)
  useEffect(() => {
    setLocalSpeaker(speaker);
  }, [speaker]);

  const handleSpeakerBlur = useCallback(() => {
    if (localSpeaker !== speaker) {
      editor.tf.setNodes({ speaker: localSpeaker } as any, { at: element });
    }
  }, [editor, element, localSpeaker, speaker]);

  return (
    <PlateElement
      {...props}
      className={cn('my-2 border-l-2 pl-4')}
    >
      <input
        type="text"
        value={localSpeaker}
        onChange={(e) => setLocalSpeaker(e.target.value)}
        onBlur={handleSpeakerBlur}
        placeholder="Speaker name..."
        contentEditable={false}
        suppressContentEditableWarning
        className={cn(
          'block text-[11px] uppercase tracking-widest opacity-50 mb-0.5',
          'bg-transparent border-none outline-none w-full p-0',
          'font-sans not-italic'
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <div>{props.children}</div>
    </PlateElement>
  );
}
