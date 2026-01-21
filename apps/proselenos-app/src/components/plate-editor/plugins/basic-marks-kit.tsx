'use client';

import {
  BoldPlugin,
  CodePlugin,
  HighlightPlugin,
  ItalicPlugin,
  KbdPlugin,
  StrikethroughPlugin,
  SubscriptPlugin,
  SuperscriptPlugin,
  UnderlinePlugin,
} from '@platejs/basic-nodes/react';

import { CodeLeaf } from '@/components/plate-ui/code-node';
import { HighlightLeaf } from '@/components/plate-ui/highlight-node';
import { KbdLeaf } from '@/components/plate-ui/kbd-node';

export const BasicMarksKit = [
  // Disable default shortcuts for bold/italic/underline
  BoldPlugin.configure({ shortcuts: {} }),
  ItalicPlugin.configure({ shortcuts: {} }),
  UnderlinePlugin.configure({ shortcuts: {} }),
  CodePlugin.configure({
    node: { component: CodeLeaf },
    shortcuts: {},
  }),
  StrikethroughPlugin.configure({
    shortcuts: {},
  }),
  SubscriptPlugin.configure({
    shortcuts: {},
  }),
  SuperscriptPlugin.configure({
    shortcuts: {},
  }),
  HighlightPlugin.configure({
    node: { component: HighlightLeaf },
    shortcuts: {},
  }),
  KbdPlugin.withComponent(KbdLeaf),
];
