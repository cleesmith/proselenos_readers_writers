'use client';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import {
  ChevronRightIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  Link2Icon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PilcrowIcon,
  PlusIcon,
  QuoteIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { type PlateEditor, useEditorRef } from 'platejs/react';
import * as React from 'react';
import {
  insertBlock,
  insertInlineElement,
} from '@/components/plate-editor/transforms';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/plate-ui/dropdown-menu';

import { ToolbarButton, ToolbarMenuGroup } from './toolbar';

type Group = {
  group: string;
  items: Item[];
};

type Item = {
  icon: React.ReactNode;
  value: string;
  onSelect: (editor: PlateEditor, value: string) => void;
  focusEditor?: boolean;
  label?: string;
};

const groups: Group[] = [
  {
    group: 'Basic blocks',
    items: [
      {
        icon: <PilcrowIcon />,
        label: 'Paragraph',
        value: KEYS.p,
      },
      {
        icon: <Heading1Icon />,
        label: 'Heading 1',
        value: 'h1',
      },
      {
        icon: <Heading2Icon />,
        label: 'Heading 2',
        value: 'h2',
      },
      {
        icon: <Heading3Icon />,
        label: 'Heading 3',
        value: 'h3',
      },
      {
        icon: <QuoteIcon />,
        label: 'Quote',
        value: KEYS.blockquote,
      },
      {
        icon: <MinusIcon />,
        label: 'Divider',
        value: KEYS.hr,
      },
      {
        icon: <ImageIcon />,
        label: 'Image',
        value: KEYS.img,
      },
    ].map((item) => ({
      ...item,
      onSelect: (editor: PlateEditor, value: string) => {
        insertBlock(editor, value);
      },
    })).concat([
      {
        icon: <Link2Icon />,
        label: 'Link',
        value: KEYS.link,
        onSelect: (editor: PlateEditor, value: string) => {
          insertInlineElement(editor, value);
        },
      },
    ]),
  },
  {
    group: 'Lists',
    items: [
      {
        icon: <ListIcon />,
        label: 'Bulleted list',
        value: KEYS.ul,
      },
      {
        icon: <ListOrderedIcon />,
        label: 'Numbered list',
        value: KEYS.ol,
      },
      {
        icon: <ChevronRightIcon />,
        label: 'Toggle list',
        value: KEYS.toggle,
      },
    ].map((item) => ({
      ...item,
      onSelect: (editor: PlateEditor, value: string) => {
        insertBlock(editor, value);
      },
    })),
  },
];

export function InsertToolbarButton(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton isDropdown pressed={open} tooltip="Insert">
          <PlusIcon />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="flex max-h-[500px] min-w-0 flex-col overflow-y-auto"
      >
        {groups.map(({ group, items: nestedItems }) => (
          <ToolbarMenuGroup key={group} label={group}>
            {nestedItems.map(({ icon, label, value, onSelect }) => (
              <DropdownMenuItem
                className="min-w-[180px]"
                key={value}
                onSelect={() => {
                  onSelect(editor, value);
                  editor.tf.focus();
                }}
              >
                {icon}
                {label}
              </DropdownMenuItem>
            ))}
          </ToolbarMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
