import * as P from '../../vendor/primitives/index.js';
import { SafeStyle, Style } from '../../vendor/stylesheet/index.js';

import {
  SVGPresentationAttributes,
  SafeSVGPresentationAttributes,
} from './base';

interface RectProps extends SVGPresentationAttributes {
  style?: SVGPresentationAttributes;
  x?: string | number;
  y?: string | number;
  width: string | number;
  height: string | number;
  rx?: string | number;
  ry?: string | number;
}

interface SafeRectProps extends SafeSVGPresentationAttributes {
  style?: SafeSVGPresentationAttributes;
  x?: number;
  y?: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
}

export type RectNode = {
  type: typeof P.Rect;
  props: RectProps;
  style?: Style | Style[];
  box?: never;
  origin?: never;
  yogaNode?: never;
  children?: never[];
};

export type SafeRectNode = Omit<RectNode, 'style' | 'props'> & {
  style: SafeStyle;
  props: SafeRectProps;
};
