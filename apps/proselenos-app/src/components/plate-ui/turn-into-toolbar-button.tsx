// @ts-nocheck
'use client';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import { DropdownMenuItemIndicator } from '@radix-ui/react-dropdown-menu';
import {
  CheckIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  MessageSquareQuoteIcon,
  PilcrowIcon,
  QuoteIcon,
  Trash2Icon,
} from 'lucide-react';
import type { TElement } from 'platejs';
import { KEYS } from 'platejs';
import { useEditorRef, useSelectionFragmentProp } from 'platejs/react';
import * as React from 'react';
import { getBlockType, setBlockType } from '@/components/plate-editor/transforms';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/plate-ui/dropdown-menu';

import { ToolbarButton, ToolbarMenuGroup } from './toolbar';

export const turnIntoItems = [
  {
    icon: <PilcrowIcon />,
    keywords: ['paragraph'],
    label: 'Text',
    value: KEYS.p,
  },
  {
    icon: <Heading1Icon />,
    keywords: ['title', 'h1'],
    label: 'Heading 1',
    value: 'h1',
  },
  {
    icon: <Heading2Icon />,
    keywords: ['subtitle', 'h2'],
    label: 'Heading 2',
    value: 'h2',
  },
  {
    icon: <Heading3Icon />,
    keywords: ['subtitle', 'h3'],
    label: 'Heading 3',
    value: 'h3',
  },
  {
    icon: <QuoteIcon />,
    keywords: ['citation', 'blockquote', '>'],
    label: 'Quote',
    value: KEYS.blockquote,
  },
  {
    icon: <MessageSquareQuoteIcon />,
    keywords: ['dialogue', 'speech', 'conversation'],
    label: 'Dialogue',
    value: 'vn_dialogue',
  },
];

export function TurnIntoToolbarButton(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  const value = useSelectionFragmentProp({
    defaultValue: KEYS.p,
    getProp: (node) => getBlockType(node as TElement),
  });
  const selectedItem = React.useMemo(
    () =>
      turnIntoItems.find((item) => item.value === (value ?? KEYS.p)) ??
      turnIntoItems[0],
    [value]
  );

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          className="min-w-[125px]"
          isDropdown
          pressed={open}
          tooltip="Turn into"
        >
          Turn Into
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="ignore-click-outside/toolbar min-w-0"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          editor.tf.focus();
        }}
      >
        <ToolbarMenuGroup
          label="Turn into"
          onValueChange={(type) => {
            setBlockType(editor, type);
          }}
          value={value}
        >
          {turnIntoItems.map(({ icon, label, value: itemValue }) => (
            <DropdownMenuRadioItem
              className="min-w-[180px] pl-2 *:first:[span]:hidden"
              key={itemValue}
              value={itemValue}
            >
              <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center">
                <DropdownMenuItemIndicator>
                  <CheckIcon />
                </DropdownMenuItemIndicator>
              </span>
              {icon}
              {label}
            </DropdownMenuRadioItem>
          ))}
        </ToolbarMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-w-[180px]"
          variant="destructive"
          onSelect={() => {
            const entry = editor.api.block();
            if (entry) {
              const [, path] = entry;
              let deletePath = path;
              // If nested, check if the top-level parent is a VN wrapper
              // (sticky_image, dialogue, etc.) and delete the whole wrapper
              if (path.length > 1) {
                const topNode = editor.children[path[0]] as any;
                if (topNode?.vnType) {
                  deletePath = [path[0]];
                }
              }
              editor.tf.removeNodes({ at: deletePath });
            }
            setOpen(false);
          }}
        >
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
