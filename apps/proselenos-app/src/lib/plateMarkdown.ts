/**
 * Plate Markdown Serialization Utilities
 *
 * This module provides utilities for converting between markdown strings
 * and Plate editor values.
 *
 * Usage:
 * - markdownToPlate(editor, markdown) - Convert markdown string to Plate Value
 * - plateToMarkdown(editor) - Convert current editor content to markdown string
 */

import { MarkdownPlugin } from '@platejs/markdown';
import type { Value } from 'platejs';

/**
 * Convert a markdown string to Plate editor Value
 */
export function markdownToPlate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any,
  markdown: string
): Value {
  if (!markdown || markdown.trim() === '') {
    // Return a minimal valid Plate document with an empty paragraph
    return [
      {
        type: 'p',
        children: [{ text: '' }],
      },
    ];
  }

  try {
    const value = editor.getApi(MarkdownPlugin).markdown.deserialize(markdown);
    return value;
  } catch (error) {
    console.error('Error deserializing markdown:', error);
    // Return a minimal valid document on error
    return [
      {
        type: 'p',
        children: [{ text: markdown }],
      },
    ];
  }
}

/**
 * Convert the current Plate editor content to a markdown string
 */
export function plateToMarkdown(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any
): string {
  try {
    const markdown = editor.getApi(MarkdownPlugin).markdown.serialize();
    return markdown;
  } catch (error) {
    console.error('Error serializing to markdown:', error);
    return '';
  }
}

/**
 * Create an empty Plate document
 */
export function createEmptyPlateValue(): Value {
  return [
    {
      type: 'p',
      children: [{ text: '' }],
    },
  ];
}
