'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PlateElement, type PlateElementProps, useEditorRef } from 'platejs/react';
import { useImageLibrary } from '@/contexts/ImageLibraryContext';

import { cn } from '@/lib/utils';

export function BlockquoteElement(props: PlateElementProps) {
  const element = props.element as any;
  const vnType = element.vnType as string | undefined;

  // Visual Narrative: dialogue with speaker label
  if (vnType === 'dialogue') {
    return <DialogueElement {...props} />;
  }

  // Visual Narrative: sticky image with scrolling text
  if (vnType === 'sticky_image') {
    return <StickyImageElement {...props} />;
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

function StickyImageElement(props: PlateElementProps) {
  const element = props.element as any;
  const editor = useEditorRef();
  const ctx = useImageLibrary();

  const imageUrl = (element.imageUrl || '') as string;
  const imageAlt = (element.imageAlt || '') as string;
  const [localAlt, setLocalAlt] = useState(imageAlt);

  // Sync alt text from Plate node when it changes externally
  useEffect(() => {
    setLocalAlt(imageAlt);
  }, [imageAlt]);

  // Resolve relative imageUrl (e.g. "images/foo.jpg") to a displayable Object URL
  const thumbnailUrl = useMemo(() => {
    if (!imageUrl || !ctx?.images) return '';
    // Strip "images/" prefix to match against filename in the library
    const filename = imageUrl.replace(/^images\//, '');
    const found = ctx.images.find(img => img.filename === filename);
    return found?.url || '';
  }, [imageUrl, ctx?.images]);

  const handleAltBlur = useCallback(() => {
    if (localAlt !== imageAlt) {
      editor.tf.setNodes({ imageAlt: localAlt } as any, { at: element });
    }
  }, [editor, element, localAlt, imageAlt]);

  const handlePickImage = useCallback(() => {
    ctx?.openImageLibrary((filename: string, altText: string) => {
      const url = filename.startsWith('images/') ? filename : `images/${filename}`;
      editor.tf.setNodes({ imageUrl: url, imageAlt: altText } as any, { at: element });
    });
  }, [ctx, editor, element]);

  return (
    <PlateElement
      {...props}
      className={cn('my-2 border border-dashed border-gray-400 rounded p-2')}
    >
      {/* CSS Grid ensures exactly 2 columns regardless of DOM changes */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40% 1fr',
          gap: '12px',
          alignItems: 'start',
        }}
      >
        {/* Left column: image + caption — pinned to column 1 */}
        <div
          contentEditable={false}
          suppressContentEditableWarning
          style={{
            gridColumn: 1,
            gridRow: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            userSelect: 'none',
          }}
        >
          <button
            type="button"
            onClick={handlePickImage}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              display: 'block',
              width: '100%',
              aspectRatio: '4/3',
              border: '1px dashed #999',
              borderRadius: '4px',
              cursor: 'pointer',
              background: thumbnailUrl ? `url(${thumbnailUrl}) center/contain no-repeat` : '#f0f0f0',
              position: 'relative',
            }}
            title="Click to choose image from library"
          >
            {!thumbnailUrl && (
              <span style={{ color: '#999', fontSize: '12px' }}>
                Click to select image
              </span>
            )}
          </button>
          <input
            type="text"
            value={localAlt}
            onChange={(e) => setLocalAlt(e.target.value)}
            onBlur={handleAltBlur}
            placeholder="Alt text / caption..."
            style={{
              display: 'block',
              fontSize: '11px',
              opacity: 0.5,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              padding: 0,
              fontFamily: 'sans-serif',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </div>

        {/* Right column: editable text — pinned to column 2 */}
        <div style={{ gridColumn: 2, gridRow: 1, minHeight: '3em' }}>
          {props.children}
        </div>
      </div>
    </PlateElement>
  );
}
