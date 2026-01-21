'use client';

import {
  CodeBlockPlugin,
  CodeLinePlugin,
  CodeSyntaxPlugin,
} from '@platejs/code-block/react';
import { all, createLowlight } from 'lowlight';

import {
  CodeBlockElement,
  CodeLineElement,
  CodeSyntaxLeaf,
} from '@/components/plate-ui/code-block-node';

const lowlight = createLowlight(all);

export const CodeBlockKit = [
  CodeBlockPlugin.configure({
    node: { component: CodeBlockElement },
    options: { lowlight },
    shortcuts: {},
  }),
  CodeLinePlugin.withComponent(CodeLineElement),
  CodeSyntaxPlugin.withComponent(CodeSyntaxLeaf),
];
