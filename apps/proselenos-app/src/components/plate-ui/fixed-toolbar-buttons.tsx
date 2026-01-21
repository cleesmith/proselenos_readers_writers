'use client';

import {
  ArrowUpToLineIcon,
  BoldIcon,
  ItalicIcon,
  WandSparklesIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { useEditorReadOnly } from 'platejs/react';

import { AIToolbarButton } from './ai-toolbar-button';
import { AlignToolbarButton } from './align-toolbar-button';
import { EmojiToolbarButton } from './emoji-toolbar-button';
import { ExportToolbarButton } from './export-toolbar-button';
import { FontSizeToolbarButton } from './font-size-toolbar-button';
import { ImportToolbarButton } from './import-toolbar-button';
import {
  IndentToolbarButton,
  OutdentToolbarButton,
} from './indent-toolbar-button';
import { InsertToolbarButton } from './insert-toolbar-button';
import { LinkToolbarButton } from './link-toolbar-button';
import {
  BulletedListToolbarButton,
  NumberedListToolbarButton,
} from './list-toolbar-button';
import { MarkToolbarButton } from './mark-toolbar-button';
import { MediaToolbarButton } from './media-toolbar-button';
import { ModeToolbarButton } from './mode-toolbar-button';
import { MoreToolbarButton } from './more-toolbar-button';
import { ToolbarGroup } from './toolbar';
import { TurnIntoToolbarButton } from './turn-into-toolbar-button';

export function FixedToolbarButtons() {
  const readOnly = useEditorReadOnly();

  return (
    <div className="flex w-full">
      {!readOnly && (
        <>
          {/* Bold, Italic, Link, Image - FAR LEFT */}
          <ToolbarGroup>
            <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold">
              <BoldIcon />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic">
              <ItalicIcon />
            </MarkToolbarButton>
            <LinkToolbarButton />
            <MediaToolbarButton nodeType={KEYS.img} />
          </ToolbarGroup>

          <ToolbarGroup>
            <AlignToolbarButton />
            <NumberedListToolbarButton />
            <BulletedListToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <ExportToolbarButton>
              <ArrowUpToLineIcon />
            </ExportToolbarButton>
            <ImportToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <InsertToolbarButton />
            <TurnIntoToolbarButton />
            <FontSizeToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <EmojiToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <OutdentToolbarButton />
            <IndentToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <MoreToolbarButton />
          </ToolbarGroup>
        </>
      )}

      <div className="grow" />

      {/* AI Commands - FAR RIGHT (before Mode) */}
      {!readOnly && (
        <ToolbarGroup>
          <AIToolbarButton tooltip="AI commands">
            <WandSparklesIcon />
          </AIToolbarButton>
        </ToolbarGroup>
      )}

      <ToolbarGroup>
        <ModeToolbarButton />
      </ToolbarGroup>
    </div>
  );
}
