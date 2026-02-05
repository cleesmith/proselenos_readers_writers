/**
 * Fountain Export for Screenplay Writers
 *
 * Exports manuscript sections to .fountain format.
 * Reads data-fountain attributes from XHTML (set during import) to reconstruct
 * proper Fountain markup and spacing. Falls back to heuristic detection for
 * user-edited content that has lost its data-fountain attributes.
 */

import { loadFullWorkingCopy, loadSettings, loadManuscriptMeta } from '@/services/manuscriptStorage';

/**
 * Represents a parsed element from XHTML with its Fountain type information
 */
interface FountainElement {
  text: string;
  type: string;        // 'character', 'dialogue', 'parenthetical', 'scene_heading', 'action', 'transition', 'centered', 'section', 'synopsis', 'lyrics', 'note', 'page_break'
  depth?: number;      // For sections: # depth
  dual?: string;       // 'left' or 'right' for dual dialogue
}

/**
 * Check if two consecutive elements should have NO blank line between them
 * (i.e., they're within the same dialogue block)
 */
function isWithinDialogueBlock(prevType: string, currentType: string): boolean {
  // character → dialogue (most common)
  if (prevType === 'character' && currentType === 'dialogue') return true;
  // character → parenthetical
  if (prevType === 'character' && currentType === 'parenthetical') return true;
  // parenthetical → dialogue
  if (prevType === 'parenthetical' && currentType === 'dialogue') return true;
  // dialogue → parenthetical (e.g., continuing dialogue with a parenthetical)
  if (prevType === 'dialogue' && currentType === 'parenthetical') return true;
  // parenthetical → parenthetical (rare but possible)
  if (prevType === 'parenthetical' && currentType === 'parenthetical') return true;
  return false;
}

/**
 * Heuristic detection of Fountain element types from plain text.
 * Used as fallback when data-fountain attributes are absent (user-edited content).
 */
function detectFountainType(text: string, prevType: string): string {
  // Page break
  if (/^={3,}$/.test(text.trim())) return 'page_break';

  // Scene heading patterns: INT. / EXT. / EST. / INT./EXT. / I./E.
  if (/^(?:(?:int|i)\.?\/(?:ext|e)|int|ext|est)[. ]/i.test(text)) return 'scene_heading';

  // Forced scene heading (starts with .)
  if (text.startsWith('.') && text.length > 1 && !text.startsWith('..')) return 'scene_heading';

  // Transition: ALL CAPS ending with TO: or forced with >
  if (/^[A-Z\s]+TO:$/.test(text.trim())) return 'transition';
  if (text.startsWith('>') && !text.endsWith('<')) return 'transition';

  // Centered text: >text<
  if (text.startsWith('>') && text.endsWith('<')) return 'centered';

  // Parenthetical: (text)
  if (/^\(.*\)$/.test(text.trim())) {
    // Only if we're in a dialogue context
    if (prevType === 'character' || prevType === 'dialogue' || prevType === 'parenthetical') {
      return 'parenthetical';
    }
  }

  // Character: ALL CAPS, possibly with (V.O.) or (O.S.) or (CONT'D)
  // Must not be a scene heading and must be reasonably short
  if (/^[A-Z][A-Z\s.'()\-]+$/.test(text.trim()) && text.trim().length < 60) {
    // Exclude things that look like they could be action (long all-caps lines)
    if (text.trim().length <= 40) return 'character';
  }

  // After a character or parenthetical, text is dialogue
  if (prevType === 'character' || prevType === 'parenthetical') return 'dialogue';

  // After dialogue, could be more dialogue (multi-paragraph)
  // Only if it doesn't match other types above
  if (prevType === 'dialogue' && !text.match(/^[A-Z][A-Z\s.'()\-]+$/)) return 'dialogue';

  // Section: starts with # (one or more)
  if (/^#{1,6}\s/.test(text)) return 'section';

  // Synopsis: starts with =
  if (text.startsWith('= ') || text.startsWith('=\t')) return 'synopsis';

  // Lyrics: starts with ~
  if (text.startsWith('~')) return 'lyrics';

  // Note: [[text]]
  if (text.startsWith('[[') && text.endsWith(']]')) return 'note';

  // Default: action
  return 'action';
}

/**
 * Format a Fountain element's text with proper Fountain markup based on its type.
 */
function formatFountainElement(element: FountainElement): string {
  const text = element.text;

  switch (element.type) {
    case 'centered':
      // Wrap with > < markers
      return `>${text}<`;

    case 'section': {
      // Prefix with # characters based on depth
      const depth = element.depth || 1;
      const hashes = '#'.repeat(depth);
      return `${hashes} ${text}`;
    }

    case 'synopsis':
      return `= ${text}`;

    case 'lyrics':
      // Prefix each line with ~
      return text.split('\n').map(line => `~${line}`).join('\n');

    case 'note':
      // Wrap with [[ ]]
      if (text.startsWith('[[') && text.endsWith(']]')) return text;
      return `[[${text}]]`;

    case 'character':
      // Append ^ for dual dialogue right character
      if (element.dual === 'right') {
        return `${text} ^`;
      }
      return text;

    case 'transition':
      // Natural transitions (ALL CAPS ending in TO:) export as-is
      if (/^[A-Z\s]+TO:$/.test(text.trim())) return text;
      // Forced transitions need > prefix restored (fountain-js strips it on parse)
      return `> ${text}`;

    case 'page_break':
      return '===';

    case 'scene_heading':
    case 'dialogue':
    case 'parenthetical':
    case 'action':
    default:
      // These are output as-is (their text already contains the proper content)
      return text;
  }
}

/**
 * Extract Fountain elements from XHTML content.
 * Reads data-fountain attributes when present, falls back to heuristic detection.
 */
function extractFountainFromXhtml(xhtml: string): FountainElement[] {
  if (!xhtml || xhtml.trim() === '') {
    return [];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xhtml, 'text/html');
  const body = doc.body;
  if (!body) return [];

  const elements: FountainElement[] = [];
  const blockEls = body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li, div');

  // Track previous type for heuristic context
  let prevType = '';

  for (const el of blockEls) {
    const text = el.textContent?.trim() || '';
    if (!text) continue;

    // Check for data-fountain attribute (set during import)
    const fountainType = el.getAttribute('data-fountain');
    const fountainDepth = el.getAttribute('data-fountain-depth');
    const fountainDual = el.getAttribute('data-fountain-dual');

    let elementType: string;
    let depth: number | undefined;
    let dual: string | undefined;

    if (fountainType) {
      // Use the stored type
      elementType = fountainType;
      if (fountainDepth) depth = parseInt(fountainDepth, 10);
      if (fountainDual) dual = fountainDual;
    } else {
      // Heuristic fallback for user-edited content
      elementType = detectFountainType(text, prevType);
    }

    elements.push({ text, type: elementType, depth, dual });
    prevType = elementType;
  }

  // If no block elements found, fall back to body text
  if (elements.length === 0) {
    const bodyText = body.textContent?.trim() || '';
    if (bodyText) {
      elements.push({ text: bodyText, type: 'action' });
    }
  }

  return elements;
}

/**
 * Generate Fountain title page block from stored fountain title page fields.
 * Falls back to constructing from title/author if no stored fields exist.
 */
function generateTitlePage(
  title: string,
  author: string,
  fountainTitlePage?: Record<string, string>
): string {
  if (fountainTitlePage && Object.keys(fountainTitlePage).length > 0) {
    // Reconstruct from stored fields in proper Fountain order
    const orderedKeys = [
      'Title', 'Credit', 'Author', 'Source', 'Notes',
      'Draft date', 'Contact', 'Copyright', 'Revision',
    ];

    const lines: string[] = [];

    // Output known fields in order
    for (const key of orderedKeys) {
      if (fountainTitlePage[key]) {
        // Multi-line values need to be indented (3 spaces per Fountain spec)
        // Trim leading/trailing newlines to prevent blank lines (fountain-js may add them from <br/> parsing)
        const value = fountainTitlePage[key].replace(/^\n+|\n+$/g, '');
        if (value.includes('\n')) {
          lines.push(`${key}:`);
          for (const valueLine of value.split('\n')) {
            lines.push(`   ${valueLine}`);
          }
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
    }

    // Output any additional fields not in the known order
    for (const [key, value] of Object.entries(fountainTitlePage)) {
      if (!orderedKeys.includes(key)) {
        lines.push(`${key}: ${value}`);
      }
    }

    if (lines.length > 0) {
      return lines.join('\n') + '\n\n';
    }
  }

  // Fallback: construct from title/author metadata
  const lines: string[] = [];
  lines.push(`Title: ${title || 'Untitled'}`);
  if (author) {
    lines.push(`Author: ${author}`);
  }
  lines.push(`Draft date: ${new Date().toLocaleDateString()}`);

  return lines.join('\n') + '\n\n';
}

/**
 * Export workspace to Fountain format
 *
 * Reads data-fountain attributes from XHTML to reconstruct proper Fountain formatting.
 * Applies correct spacing: single newline within dialogue blocks, double newline elsewhere.
 *
 * @returns Blob containing the .fountain file as plain text
 * @throws Error if no manuscript is loaded
 */
export async function exportWorkspaceToFountain(): Promise<Blob> {
  const workingCopy = await loadFullWorkingCopy();
  if (!workingCopy || workingCopy.sections.length === 0) {
    throw new Error('No manuscript loaded');
  }

  // Load metadata for title page
  const meta = await loadSettings();
  const manuscriptMeta = await loadManuscriptMeta();

  // Build the Fountain document
  const parts: string[] = [];

  // Add title page (using stored fountain title page fields if available)
  parts.push(generateTitlePage(
    meta?.title || workingCopy.title || 'Untitled',
    meta?.author || workingCopy.author || '',
    manuscriptMeta?.fountainTitlePage
  ));

  // Add each section (no headers - screenplays flow as flat documents)
  for (const section of workingCopy.sections) {
    // Skip Title Page — content is already in the Fountain title page metadata block
    if (section.id === 'title-page' || section.title.toLowerCase() === 'title page') continue;

    // Extract Fountain elements with type information
    const elements = extractFountainFromXhtml(section.xhtml);
    if (elements.length === 0) continue;

    // Build section content with proper Fountain spacing
    let sectionText = '';
    let prevType = '';

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (!element) continue;
      const formatted = formatFountainElement(element);

      if (i === 0) {
        // First element in section — add blank line separator from previous section
        if (parts.length > 1) {
          // Not the first section content after title page
          sectionText = formatted;
        } else {
          sectionText = formatted;
        }
      } else if (isWithinDialogueBlock(prevType, element.type)) {
        // Within dialogue block: single newline (no blank line)
        sectionText += '\n' + formatted;
      } else {
        // Between other elements: double newline (blank line separator)
        sectionText += '\n\n' + formatted;
      }

      prevType = element.type;
    }

    if (sectionText) {
      parts.push(sectionText);
    }
  }

  // Join sections with double newline (blank line between sections)
  const fountainText = parts.join('\n\n');

  return new Blob([fountainText], { type: 'text/plain' });
}
