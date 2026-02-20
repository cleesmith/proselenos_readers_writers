'use client';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import {
  CornerDownLeftIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  MessageSquareQuoteIcon,
  MinusIcon,
  PilcrowIcon,
  PinIcon,
  PlusIcon,
  QuoteIcon,
  SparklesIcon,
  TypeIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { type PlateEditor, useEditorRef } from 'platejs/react';
import * as React from 'react';
import { insertBlock } from '@/components/plate-editor/transforms';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/plate-ui/dropdown-menu';
import { useWallpaper } from '@/contexts/WallpaperContext';

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
        icon: <CornerDownLeftIcon />,
        label: 'Line break',
        value: 'line_break',
      },
      {
        icon: <MinusIcon />,
        label: 'Divider',
        value: KEYS.hr,
      },
    ].map((item) => ({
      ...item,
      onSelect: (editor: PlateEditor, value: string) => {
        insertBlock(editor, value);
      },
    })),
  },
  {
    group: 'Visual Narrative',
    items: [
      {
        icon: <MessageSquareQuoteIcon />,
        label: 'Dialogue',
        value: 'vn_dialogue',
      },
      {
        icon: <TypeIcon />,
        label: 'Internal Thought',
        value: 'vn_internal',
      },
      {
        icon: <SparklesIcon />,
        label: 'Emphasis Line',
        value: 'vn_emphasis',
      },
      {
        icon: <MinusIcon />,
        label: 'Scene Break',
        value: 'vn_scene_break',
      },
      {
        icon: <PinIcon />,
        label: 'Sticky Image',
        value: 'vn_sticky_image',
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
  const wallpaper = useWallpaper();

  // Build dynamic groups: append "Choose Wallpaper" to VN group for wallpaper-chapter sections
  const dynamicGroups = React.useMemo(() => {
    if (wallpaper?.sectionType !== 'wallpaper-chapter') return groups;

    return groups.map(g => {
      if (g.group !== 'Visual Narrative') return g;
      const wallpaperLabel = wallpaper.currentWallpaper
        ? `Wallpaper: ${wallpaper.currentWallpaper}`
        : 'Choose Wallpaper';
      return {
        ...g,
        items: [
          ...g.items,
          {
            icon: <ImageIcon />,
            label: wallpaperLabel,
            value: 'wallpaper_choose',
            onSelect: () => {
              wallpaper.chooseWallpaper();
            },
          } as Item,
        ],
      };
    });
  }, [wallpaper]);

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
        {dynamicGroups.map(({ group, items: nestedItems }) => (
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
