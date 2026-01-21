'use client';

import { TogglePlugin } from '@platejs/toggle/react';

import { IndentKit } from '@/components/plate-editor/plugins/indent-kit';
import { ToggleElement } from '@/components/plate-ui/toggle-node';

export const ToggleKit = [
  ...IndentKit,
  TogglePlugin.withComponent(ToggleElement),
];
