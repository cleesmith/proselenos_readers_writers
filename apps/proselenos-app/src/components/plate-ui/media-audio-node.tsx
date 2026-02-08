/* eslint-disable */
'use client';

import { useMediaState } from '@platejs/media/react';
import { ResizableProvider } from '@platejs/resizable';
import type { TAudioElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement, withHOC } from 'platejs/react';

import { cn } from '@/lib/utils';
import { useResolvedAudioUrl } from '@/hooks/use-resolved-audio-url';

import { Caption, CaptionTextarea } from './caption';

export const AudioElement = withHOC(
  ResizableProvider,
  function AudioElement(props: PlateElementProps<TAudioElement>) {
    const { align = 'center', readOnly, unsafeUrl } = useMediaState();

    // Resolve the audio URL from IndexedDB if it's a local path
    const { resolvedUrl, isLoading, error } = useResolvedAudioUrl(unsafeUrl);

    return (
      <PlateElement {...props} className="mb-1">
        <figure
          className="group relative cursor-default"
          contentEditable={false}
        >
          <div className="h-16">
            {isLoading && (
              <div className={cn(
                'flex items-center justify-center bg-muted rounded-sm',
                'h-full w-full'
              )}>
                <span className="text-muted-foreground text-sm">Loading audio...</span>
              </div>
            )}

            {!isLoading && error && (
              <div className={cn(
                'flex items-center justify-center bg-destructive/10 rounded-sm border border-destructive/20',
                'h-full w-full p-2'
              )}>
                <span className="text-destructive text-sm">{error}</span>
              </div>
            )}

            {!isLoading && !error && resolvedUrl && (
              <audio className="size-full" controls src={resolvedUrl} />
            )}
          </div>

          <Caption align={align} style={{ width: '100%' }}>
            <CaptionTextarea
              className="h-20"
              placeholder="Write a caption..."
              readOnly={readOnly}
            />
          </Caption>
        </figure>
        {props.children}
      </PlateElement>
    );
  }
);
