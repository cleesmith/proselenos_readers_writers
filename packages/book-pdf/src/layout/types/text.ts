import * as P from '../../vendor/primitives/index.js';
import { SafeStyle, Style } from '../../vendor/stylesheet/index.js';
import type { HyphenationCallback } from '../../font/index';
import { YogaNode } from 'yoga-layout/load';
import { Paragraph } from '../../vendor/textkit';

import { Box, NodeProps, Origin, RenderProp } from './base';
import { SafeTextInstanceNode, TextInstanceNode } from './text-instance';
import { ImageNode, SafeImageNode } from './image';
import { SafeTspanNode, TspanNode } from './tspan';

interface TextProps extends NodeProps {
  /**
   * Enable/disable page wrapping for element.
   */
  wrap?: boolean;
  render?: RenderProp;
  /**
   * Override the default hyphenation-callback
   */
  hyphenationCallback?: HyphenationCallback;
  /**
   * Specifies the minimum number of lines in a text element that must be shown at the bottom of a page or its container.
   */
  orphans?: number;
  /**
   * Specifies the minimum number of lines in a text element that must be shown at the top of a page or its container.
   */
  widows?: number;
  // Svg props
  x?: number;
  y?: number;
}

export type TextNode = {
  type: typeof P.Text;
  props: TextProps;
  style?: Style | Style[];
  box?: Box;
  origin?: Origin;
  yogaNode?: YogaNode;
  lines?: Paragraph;
  alignOffset?: number; // TODO: Remove this
  children?: (TextNode | TextInstanceNode | ImageNode | TspanNode)[];
};

export type SafeTextNode = Omit<TextNode, 'style' | 'children'> & {
  style: SafeStyle;
  children?: (
    | SafeTextNode
    | SafeTextInstanceNode
    | SafeImageNode
    | SafeTspanNode
  )[];
};
