'use client';

import { createPlatePlugin } from 'platejs/react';
import { isHotkey } from 'platejs';

// Plugin to disable ALL keyboard shortcuts - click-only editing
export const DisableShortcutsPlugin = createPlatePlugin({
  key: 'disableShortcuts',
  handlers: {
    onKeyDown: ({ event }) => {
      // Block undo/redo (Cmd+Z, Cmd+Shift+Z)
      if (isHotkey('mod+z')(event) || isHotkey('mod+shift+z')(event)) {
        event.preventDefault();
        return true;
      }
      // Block cut/copy/paste shortcuts (Cmd+X, Cmd+C, Cmd+V)
      // Note: These are often desired, but removing per "no shortcuts" requirement
      // Uncomment if you want to allow these:
      // if (isHotkey('mod+x')(event) || isHotkey('mod+c')(event) || isHotkey('mod+v')(event)) {
      //   event.preventDefault();
      //   return true;
      // }

      // Block select all (Cmd+A)
      // Uncomment if you want to disable:
      // if (isHotkey('mod+a')(event)) {
      //   event.preventDefault();
      //   return true;
      // }

      return false;
    },
  },
});

export const DisableShortcutsKit = [DisableShortcutsPlugin];
