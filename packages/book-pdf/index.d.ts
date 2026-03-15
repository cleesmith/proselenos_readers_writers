// Type declarations for book-pdf
// Proper React component types (not primitive string constants)

import type { ReactElement, ReactNode } from 'react';

// Permissive style type — avoids strict literal-type errors from book-pdf/types
type Style = Record<string, any>;

type PageSize = string | number | [number, number];

// ── Component Props ──────────────────────────────────────────────

interface DocumentProps {
  children?: ReactNode;
  style?: Style | Style[];
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  keywords?: string;
  producer?: string;
  language?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pdfVersion?: string;
  pageMode?: string;
  pageLayout?: string;
}

interface NodeProps {
  id?: string;
  style?: Style | Style[];
  fixed?: boolean;
  break?: boolean;
  minPresenceAhead?: number;
  children?: ReactNode;
}

interface PageProps extends NodeProps {
  wrap?: boolean;
  debug?: boolean;
  size?: PageSize;
  orientation?: string;
  dpi?: number;
  bookmark?: any;
}

interface ViewProps extends NodeProps {
  wrap?: boolean;
  debug?: boolean;
  render?: (props: { pageNumber: number; subPageNumber: number }) => ReactNode;
}

interface TextProps extends NodeProps {
  wrap?: boolean;
  debug?: boolean;
  render?: (props: {
    pageNumber: number;
    totalPages: number;
    subPageNumber: number;
    subPageTotalPages: number;
  }) => ReactNode;
  hyphenationCallback?: (word: string) => string[];
  orphans?: number;
  widows?: number;
}

interface ImageProps {
  id?: string;
  style?: Style | Style[];
  fixed?: boolean;
  break?: boolean;
  minPresenceAhead?: number;
  debug?: boolean;
  cache?: boolean;
  src?: any;
  source?: any;
}

// ── Components (declared as functions for JSX compatibility) ─────

export declare function Document(props: DocumentProps): ReactElement;
export declare function Page(props: PageProps): ReactElement;
export declare function View(props: ViewProps): ReactElement;
export declare function Text(props: TextProps): ReactElement;
export declare function Image(props: ImageProps): ReactElement;

// ── Utilities ────────────────────────────────────────────────────

export declare const Font: {
  register: (data: any) => void;
  registerEmojiSource: (source: any) => void;
  registerHyphenationCallback: (callback: (word: string) => string[]) => void;
  getRegisteredFonts: () => any;
  getRegisteredFontFamilies: () => string[];
  clear: () => void;
  reset: () => void;
};

export declare const StyleSheet: {
  create: <T extends Record<string, any>>(styles: T) => T;
};

export declare function pdf(
  initialValue?: ReactElement<DocumentProps>,
): {
  container: any;
  isDirty: () => boolean;
  toString: () => string;
  toBlob: () => Promise<Blob>;
  toBuffer: () => Promise<any>;
  on: (event: string, listener: (...args: any[]) => void) => void;
  removeListener: (event: string, listener: (...args: any[]) => void) => void;
  updateContainer: (doc: ReactElement<any>, callback?: () => void) => void;
};
