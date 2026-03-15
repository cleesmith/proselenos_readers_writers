import * as fontkit from 'fontkit';

export type Font = Omit<fontkit.Font, 'type'> & {
    type: 'TTF' | 'WOFF' | 'WOFF2' | 'STANDARD';
    encode?: (string: string) => number[];
};
export type FontStyle = 'normal' | 'italic' | 'oblique';
export type FontWeight = number | 'thin' | 'ultralight' | 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'ultrabold' | 'heavy';
export type EmojiSource = { url: string; format?: string; withVariationSelectors?: boolean } | { builder: (code: string) => string; withVariationSelectors?: boolean };
export type FontDescriptor = {
    fontFamily: string;
    fontStyle?: FontStyle;
    fontWeight?: FontWeight;
};
export type HyphenationCallback = (word: string) => string[];
export type FontStore = any;
