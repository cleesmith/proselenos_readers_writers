'use client';

import { ListStyleType, someList, toggleList } from '@platejs/list';
import {
  useIndentTodoToolBarButton,
  useIndentTodoToolBarButtonState,
} from '@platejs/list/react';
import { List, ListOrdered, ListTodoIcon } from 'lucide-react';
import { useEditorRef, useEditorSelector } from 'platejs/react';
import * as React from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/plate-ui/dropdown-menu';

import { ToolbarButton } from './toolbar';

export function ListToolbarButton() {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  const pressed = useEditorSelector(
    (editor) =>
      someList(editor, [
        ListStyleType.Disc,
        ListStyleType.Decimal,
      ]),
    []
  );

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          isDropdown
          pressed={open || pressed}
          tooltip="List"
        >
          <List className="size-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() =>
              toggleList(editor, {
                listStyleType: ListStyleType.Disc,
              })
            }
          >
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full border border-current bg-current" />
              List Default
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              toggleList(editor, {
                listStyleType: ListStyleType.Decimal,
              })
            }
          >
            <div className="flex items-center gap-2">
              <ListOrdered className="size-4" />
              List Decimal
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TodoListToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>
) {
  const state = useIndentTodoToolBarButtonState({ nodeType: 'todo' });
  const { props: buttonProps } = useIndentTodoToolBarButton(state);

  return (
    <ToolbarButton {...props} {...buttonProps} tooltip="Todo">
      <ListTodoIcon />
    </ToolbarButton>
  );
}
