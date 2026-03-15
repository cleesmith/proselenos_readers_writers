import * as P from '../../vendor/primitives/index.js';
import { SafeStyle, Style } from '../../vendor/stylesheet/index.js';
import { Paragraph } from '../../vendor/textkit';

import {
  SVGPresentationAttributes,
  SafeSVGPresentationAttributes,
} from './base';
import { SafeTextInstanceNode, TextInstanceNode } from './text-instance';

interface TspanProps extends SVGPresentationAttributes {
  x?: string | number;
  y?: string | number;
}

interface SafeTspanProps extends SafeSVGPresentationAttributes {
  x?: number;
  y?: number;
}

export type TspanNode = {
  type: typeof P.Tspan;
  props: TspanProps;
  style?: Style | Style[];
  box?: never;
  origin?: never;
  yogaNode?: never;
  lines?: Paragraph;
  children?: TextInstanceNode[];
};

export type SafeTspanNode = Omit<TspanNode, 'style' | 'props' | 'children'> & {
  style: SafeStyle;
  props: SafeTspanProps;
  children?: SafeTextInstanceNode[];
};
