import FontFamily from './font-family';

import {
  BulkLoad,
  EmojiSource,
  FontDescriptor,
  HyphenationCallback,
  SingleLoad,
} from './types';

class FontStore {
  fontFamilies: Record<string, FontFamily> = {};

  emojiSource: EmojiSource | null = null;

  // No constructor — fonts are registered at module scope in index.js
  // via embedded base64 data URIs (no network requests).

  hyphenationCallback: HyphenationCallback | null = null;

  register = (data: SingleLoad | BulkLoad) => {
    const { family } = data;

    if (!this.fontFamilies[family]) {
      this.fontFamilies[family] = FontFamily.create(family);
    }

    // Bulk loading
    if ('fonts' in data) {
      for (let i = 0; i < data.fonts.length; i += 1) {
        const { src, fontStyle, fontWeight, ...options } = data.fonts[i];
        this.fontFamilies[family].register({
          src,
          fontStyle,
          fontWeight,
          ...options,
        });
      }
    } else {
      const { src, fontStyle, fontWeight, ...options } = data;
      this.fontFamilies[family].register({
        src,
        fontStyle,
        fontWeight,
        ...options,
      });
    }
  };

  registerEmojiSource = (emojiSource: EmojiSource) => {
    this.emojiSource = emojiSource;
  };

  registerHyphenationCallback = (callback: HyphenationCallback) => {
    this.hyphenationCallback = callback;
  };

  getFont = (descriptor: FontDescriptor) => {
    const { fontFamily } = descriptor;

    if (!this.fontFamilies[fontFamily]) {
      throw new Error(
        `Font family not registered: ${fontFamily}. Please register it calling Font.register() method.`,
      );
    }

    return this.fontFamilies[fontFamily].resolve(descriptor);
  };

  load = async (descriptor: FontDescriptor) => {
    const font = this.getFont(descriptor);
    if (font) await font.load();
  };

  reset = () => {
    const keys = Object.keys(this.fontFamilies);

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      for (let j = 0; j < this.fontFamilies[key].sources.length; j++) {
        const fontSource = this.fontFamilies[key].sources[j];
        fontSource.data = null;
      }
    }
  };

  clear = () => {
    this.fontFamilies = {};
    this.emojiSource = null;
    this.hyphenationCallback = null;
  };

  getRegisteredFonts = () => this.fontFamilies;

  getEmojiSource = (): EmojiSource | null => this.emojiSource;

  getHyphenationCallback = (): HyphenationCallback | null =>
    this.hyphenationCallback;

  getRegisteredFontFamilies = (): string[] => Object.keys(this.fontFamilies);
}

export type FontStoreType = FontStore;

export * from './types';

export default FontStore;
