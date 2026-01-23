'use client';

import { FindReplacePlugin } from '@platejs/find-replace';
import { SearchHighlightLeaf } from '@/components/plate-ui/search-highlight-leaf';

export const FindReplaceKit = [
  FindReplacePlugin.configure({
    node: { component: SearchHighlightLeaf },
  }),
];
