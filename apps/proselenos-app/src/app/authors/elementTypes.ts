// apps/proselenos-app/src/app/authors/elementTypes.ts

// Element type definitions for Vellum-style book sections
// Based on Vellum's Element Type Catalog

// Element type union - all possible section types
export type ElementType =
  // Main content
  | 'chapter'
  // Cover (always first, cannot be deleted or moved)
  | 'cover'
  // Front Matter
  | 'blurbs'
  | 'half-title'
  | 'title-page'
  | 'copyright'
  | 'dedication'
  | 'epigraph'
  | 'table-of-contents'
  // Introductory
  | 'foreword'
  | 'introduction'
  | 'preface'
  | 'prologue'
  // Back Matter
  | 'epilogue'
  | 'afterword'
  | 'endnotes'
  | 'bibliography'
  | 'acknowledgments'
  | 'about-the-author'
  | 'also-by'
  // Other
  | 'uncategorized'
  // Legacy support
  | 'section';

export interface ElementDefinition {
  type: ElementType;
  displayName: string;
  defaultTitle: string;
  description: string;
}

export interface ElementGroup {
  name: string; // Empty string for ungrouped (Chapter at top)
  elements: ElementDefinition[];
}

export const ELEMENT_GROUPS: ElementGroup[] = [
  {
    name: '', // No group header for Chapter (top item)
    elements: [
      { type: 'chapter', displayName: 'Chapter', defaultTitle: 'Chapter', description: 'Standard chapter' },
    ],
  },
  {
    name: 'Front Matter',
    elements: [
      { type: 'blurbs', displayName: 'Blurbs', defaultTitle: 'Blurbs', description: 'Praise and endorsements' },
      { type: 'half-title', displayName: 'Half Title', defaultTitle: 'Half Title', description: 'Title page before main title' },
      { type: 'title-page', displayName: 'Title Page', defaultTitle: 'Title Page', description: 'Main title page' },
      { type: 'copyright', displayName: 'Copyright', defaultTitle: 'Copyright', description: 'Copyright and legal notices' },
      { type: 'dedication', displayName: 'Dedication', defaultTitle: 'Dedication', description: 'Book dedication' },
      { type: 'epigraph', displayName: 'Epigraph', defaultTitle: 'Epigraph', description: 'Opening quote' },
      { type: 'table-of-contents', displayName: 'Table of Contents', defaultTitle: 'Contents', description: 'Table of contents' },
    ],
  },
  {
    name: 'Introductory',
    elements: [
      { type: 'foreword', displayName: 'Foreword', defaultTitle: 'Foreword', description: 'Written by someone other than author' },
      { type: 'introduction', displayName: 'Introduction', defaultTitle: 'Introduction', description: 'Author introduction' },
      { type: 'preface', displayName: 'Preface', defaultTitle: 'Preface', description: 'Author preface' },
      { type: 'prologue', displayName: 'Prologue', defaultTitle: 'Prologue', description: 'Story prologue' },
    ],
  },
  {
    name: 'Back Matter',
    elements: [
      { type: 'epilogue', displayName: 'Epilogue', defaultTitle: 'Epilogue', description: 'Story epilogue' },
      { type: 'afterword', displayName: 'Afterword', defaultTitle: 'Afterword', description: 'Author afterword' },
      { type: 'endnotes', displayName: 'Endnotes', defaultTitle: 'Endnotes', description: 'End notes' },
      { type: 'bibliography', displayName: 'Bibliography', defaultTitle: 'Bibliography', description: 'References' },
      { type: 'acknowledgments', displayName: 'Acknowledgments', defaultTitle: 'Acknowledgments', description: 'Thanks and credits' },
      { type: 'about-the-author', displayName: 'About the Author', defaultTitle: 'About the Author', description: 'Author bio' },
      { type: 'also-by', displayName: 'Also By', defaultTitle: 'Also By', description: 'Other books by author' },
    ],
  },
  {
    name: 'Other',
    elements: [
      { type: 'uncategorized', displayName: 'Uncategorized', defaultTitle: 'Untitled', description: 'Generic section' },
    ],
  },
];

// Flat lookup for getting element info by type
export const ELEMENT_MAP = new Map<ElementType, ElementDefinition>(
  ELEMENT_GROUPS.flatMap(g => g.elements).map(e => [e.type, e])
);

// Add cover element (not in ELEMENT_GROUPS since users can't add more covers)
ELEMENT_MAP.set('cover', {
  type: 'cover',
  displayName: 'Cover',
  defaultTitle: 'Cover',
  description: 'Book cover image',
});

// Protected sections that cannot be deleted or moved (always first 3)
export const PROTECTED_SECTION_IDS = ['cover', 'title-page', 'copyright'] as const;
export const PROTECTED_SECTION_COUNT = PROTECTED_SECTION_IDS.length;

// Types that can have multiple instances (all others are singletons)
export const MULTI_INSTANCE_TYPES: ElementType[] = ['chapter', 'uncategorized'];

// Types hidden from "Add Section" UI (protected sections that always exist, or generated during publish)
export const HIDDEN_TYPES: ElementType[] = ['table-of-contents', 'cover', 'title-page', 'copyright'];

// Check if a type can only exist once
export function isSingletonType(type: ElementType): boolean {
  return !MULTI_INSTANCE_TYPES.includes(type);
}

// Helper to get default title for a type
export function getDefaultTitle(elementType: ElementType): string {
  return ELEMENT_MAP.get(elementType)?.defaultTitle ?? 'Untitled';
}

// Helper for backward compatibility - maps old types to new
export function normalizeElementType(type: string | undefined): ElementType {
  if (!type) return 'section';
  if (type === 'section' || type === 'chapter') return type;
  if (ELEMENT_MAP.has(type as ElementType)) return type as ElementType;
  return 'section'; // fallback for unknown types
}
