'use client';

import {
  BoldIcon,
  ItalicIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { useEditorReadOnly } from 'platejs/react';


import { UndoToolbarButton, RedoToolbarButton } from './history-toolbar-button';
import { AlignToolbarButton } from './align-toolbar-button';
import { FontSizeToolbarButton } from './font-size-toolbar-button';
import { ImportToolbarButton } from './import-toolbar-button';
import { EmojiToolbarButton } from './emoji-toolbar-button';
import {
  IndentToolbarButton,
  OutdentToolbarButton,
} from './indent-toolbar-button';
import { InsertToolbarButton } from './insert-toolbar-button';
import { LinkToolbarButton } from './link-toolbar-button';
import { ListToolbarButton } from './list-toolbar-button';
import { MarkToolbarButton } from './mark-toolbar-button';
import { MediaToolbarButton } from './media-toolbar-button';
import { MoreToolbarButton } from './more-toolbar-button';
import { ToolbarGroup } from './toolbar';
import { TurnIntoToolbarButton } from './turn-into-toolbar-button';

export function FixedToolbarButtons() {
  const readOnly = useEditorReadOnly();

  return (
    <div className="flex w-full">
      {!readOnly && (
        <>
          <ToolbarGroup key="history">
            <UndoToolbarButton />
            <RedoToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup key="insert">
            <InsertToolbarButton />
            <TurnIntoToolbarButton />
            <FontSizeToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup key="marks">
            <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold">
              <BoldIcon />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic">
              <ItalicIcon />
            </MarkToolbarButton>
            <LinkToolbarButton />
            <MediaToolbarButton nodeType={KEYS.img} />
            <MediaToolbarButton nodeType={KEYS.audio} />
          </ToolbarGroup>

          <ToolbarGroup key="align">
            <AlignToolbarButton />
            <ListToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup key="indent">
            <OutdentToolbarButton />
            <IndentToolbarButton />
            <EmojiToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup key="more">
            <MoreToolbarButton />
            <ImportToolbarButton />
          </ToolbarGroup>
        </>
      )}

      <div className="grow" />
    </div>
  );
}
