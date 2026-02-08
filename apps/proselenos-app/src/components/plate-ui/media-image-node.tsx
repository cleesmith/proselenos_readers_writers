'use client';

import React, { useCallback } from 'react';
import { useDraggable } from '@platejs/dnd';
import { ImagePlugin, useMediaState } from '@platejs/media/react';
import { ResizableProvider, useResizableValue } from '@platejs/resizable';
import type { TImageElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement, useEditorRef, withHOC } from 'platejs/react';

import { cn } from '@/lib/utils';
import { useResolvedImageUrl } from '@/hooks/use-resolved-image-url';

import { Caption, CaptionTextarea } from './caption';
import { MediaToolbar } from './media-toolbar';
import {
  mediaResizeHandleVariants,
  Resizable,
  ResizeHandle,
} from './resize-handle';

// Visual Narrative layout cycle order
const VN_LAYOUTS = ['wide', 'centered', 'inline-right', 'inline-left'] as const;
const VN_LAYOUT_LABELS: Record<string, string> = {
  'wide': 'WIDE',
  'centered': 'CENTER',
  'inline-right': 'FLOAT-R',
  'inline-left': 'FLOAT-L',
};

export const ImageElement = withHOC(
  ResizableProvider,
  function ImageElement(props: PlateElementProps<TImageElement>) {
    const { align = 'center', focused, readOnly, selected } = useMediaState();
    const width = useResizableValue('width');
    const editor = useEditorRef();

    const { isDragging, handleRef } = useDraggable({
      element: props.element,
    });

    // Resolve the image URL from IndexedDB if it's a local path
    const imageUrl = props.element.url as string | undefined;
    const { resolvedUrl, isLoading, error } = useResolvedImageUrl(imageUrl);

    // Visual Narrative layout
    const vnLayout = (props.element as any).vnLayout as string | undefined;

    const handleLayoutCycle = useCallback(() => {
      if (readOnly) return;
      const currentIndex = vnLayout ? VN_LAYOUTS.indexOf(vnLayout as any) : -1;
      const nextIndex = (currentIndex + 1) % (VN_LAYOUTS.length + 1);
      const nextLayout = nextIndex < VN_LAYOUTS.length ? VN_LAYOUTS[nextIndex] : undefined;
      editor.tf.setNodes(
        { vnLayout: nextLayout ?? null } as any,
        { at: props.element }
      );
    }, [editor, props.element, vnLayout, readOnly]);

    return (
      <MediaToolbar plugin={ImagePlugin}>
        <PlateElement {...props} className="py-2.5">
          <figure className="group relative m-0" contentEditable={false}>
            <Resizable
              align={align}
              options={{
                align,
                readOnly,
              }}
            >
              <ResizeHandle
                className={mediaResizeHandleVariants({ direction: 'left' })}
                options={{ direction: 'left' }}
              />

              {/* Loading state */}
              {isLoading && (
                <div
                  className={cn(
                    'flex items-center justify-center bg-muted rounded-sm',
                    'min-h-[100px] w-full'
                  )}
                >
                  <span className="text-muted-foreground text-sm">Loading image...</span>
                </div>
              )}

              {/* Error state */}
              {!isLoading && error && (
                <div
                  className={cn(
                    'flex items-center justify-center bg-destructive/10 rounded-sm border border-destructive/20',
                    'min-h-[100px] w-full p-4'
                  )}
                >
                  <span className="text-destructive text-sm">{error}</span>
                </div>
              )}

              {/* Image display */}
              {!isLoading && !error && resolvedUrl && (
                <img
                  ref={handleRef as React.LegacyRef<HTMLImageElement>}
                  src={resolvedUrl}
                  alt={(props.element.alt as string) || ''}
                  className={cn(
                    'block w-full max-w-full cursor-pointer object-cover px-0',
                    'rounded-sm',
                    focused && selected && 'ring-2 ring-ring ring-offset-2',
                    isDragging && 'opacity-50'
                  )}
                  draggable={false}
                />
              )}

              <ResizeHandle
                className={mediaResizeHandleVariants({
                  direction: 'right',
                })}
                options={{ direction: 'right' }}
              />
            </Resizable>

            {/* Visual Narrative layout badge — click to cycle */}
            {!readOnly && (
              <button
                type="button"
                onClick={handleLayoutCycle}
                title={vnLayout ? `Layout: ${vnLayout} (click to cycle)` : 'Set VN layout (click to cycle)'}
                className={cn(
                  'absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded text-[10px] font-mono',
                  'cursor-pointer select-none transition-opacity',
                  vnLayout
                    ? 'bg-indigo-600 text-white opacity-80 hover:opacity-100'
                    : 'bg-muted text-muted-foreground opacity-0 group-hover:opacity-60 hover:!opacity-100'
                )}
              >
                {vnLayout ? VN_LAYOUT_LABELS[vnLayout] || vnLayout.toUpperCase() : 'LAYOUT'}
              </button>
            )}

            <Caption align={align} style={{ width }}>
              <CaptionTextarea
                onFocus={(e) => {
                  e.preventDefault();
                }}
                placeholder="Write a caption..."
                readOnly={readOnly}
              />
            </Caption>
          </figure>

          {props.children}
        </PlateElement>
      </MediaToolbar>
    );
  }
);
