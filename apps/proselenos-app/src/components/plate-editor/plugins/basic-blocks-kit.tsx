'use client';

import {
  BlockquotePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  H4Plugin,
  H5Plugin,
  H6Plugin,
  HorizontalRulePlugin,
} from '@platejs/basic-nodes/react';
import { ParagraphPlugin } from 'platejs/react';

import { BlockquoteElement } from '@/components/plate-ui/blockquote-node';
import {
  H1Element,
  H2Element,
  H3Element,
  H4Element,
  H5Element,
  H6Element,
} from '@/components/plate-ui/heading-node';
import { HrElement } from '@/components/plate-ui/hr-node';
import { ParagraphElement } from '@/components/plate-ui/paragraph-node';

export const BasicBlocksKit = [
  ParagraphPlugin.withComponent(ParagraphElement),
  H1Plugin.configure({
    node: {
      component: H1Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: {},
  }),
  H2Plugin.configure({
    node: {
      component: H2Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: {},
  }),
  H3Plugin.configure({
    node: {
      component: H3Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: {},
  }),
  H4Plugin.configure({
    node: {
      component: H4Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: {},
  }),
  H5Plugin.configure({
    node: {
      component: H5Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: {},
  }),
  H6Plugin.configure({
    node: {
      component: H6Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: {},
  }),
  BlockquotePlugin.configure({
    node: { component: BlockquoteElement },
    shortcuts: {},
  }),
  HorizontalRulePlugin.withComponent(HrElement),
];
