'use client';

import { AutoformatPlugin } from '@platejs/autoformat';

// Autoformat disabled - all formatting via toolbar clicks only
export const AutoformatKit = [
  AutoformatPlugin.configure({
    options: {
      enableUndoOnDelete: false,
      rules: [], // No autoformat rules - click-only formatting
    },
  }),
];
